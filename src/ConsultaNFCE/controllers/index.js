import { Tools } from 'node-sped-nfe';
import fs from 'fs';
import xlsx from 'xlsx';
import path from 'path';
import archiver from 'archiver';
import axios from 'axios';
import os from 'os';
import  NFeWizard  from 'nfewizard-io';

function extrairCStat(xml) {
  const match = String(xml).match(/<cStat>(\d+)<\/cStat>/);
  return match ? match[1] : 'SEM_CSTAT';
}

async function getCertOptions(senha, fallbackPfxPath = './GTO COMERCIO 2025-2026.pfx') {
  // 1) PFX via env base64
  const pfxBase64 = process.env.CERT_PFX_BASE64;
  if (pfxBase64) {
    try {
      const pfxBuf = Buffer.from(pfxBase64, 'base64');
      // tenta gravar em um tmp para compatibilidade com bibliotecas que pedem caminho
      try {
        const tmpPath = path.join(os.tmpdir(), fallbackPfxPath.replace(/[^a-zA-Z0-9.\-_]/g, '_'));
        fs.writeFileSync(tmpPath, pfxBuf, { flag: 'w' });
        process.env.CERT_PFX_PATH = tmpPath;
      } catch (e) {
        // se não gravar, não é crítico — ainda temos o buffer
        console.warn('getCertOptions: não foi possível gravar PFX em tmp:', e?.message || e);
      }
      return { pfx: pfxBuf, senha };
    } catch (e) {
      console.error('getCertOptions: falha ao decodificar CERT_PFX_BASE64:', e?.message || e);
    }
  }

  // 2) PFX arquivo local
  if (fs.existsSync(fallbackPfxPath)) {
    try {
      const pfxBuf = fs.readFileSync(fallbackPfxPath);
      process.env.CERT_PFX_PATH = fallbackPfxPath;
      return { pfx: pfxBuf, senha };
    } catch (e) {
      console.warn('getCertOptions: falha ao ler PFX local:', e?.message || e);
    }
  }

  // 3) PEM via envs base64
  const pemCertBase64 = process.env.CERT_PEM_CERT_BASE64;
  const pemKeyBase64 = process.env.CERT_PEM_KEY_BASE64;
  if (pemCertBase64 && pemKeyBase64) {
    try {
      const certBuf = Buffer.from(pemCertBase64, 'base64');
      const keyBuf = Buffer.from(pemKeyBase64, 'base64');
      try {
        const certPath = path.join(os.tmpdir(), 'cert.pem');
        const keyPath = path.join(os.tmpdir(), 'key.pem');
        fs.writeFileSync(certPath, certBuf, { flag: 'w' });
        fs.writeFileSync(keyPath, keyBuf, { flag: 'w' });
        process.env.CERT_PEM_CERT_PATH = certPath;
        process.env.CERT_PEM_KEY_PATH = keyPath;
      } catch (e) {
        console.warn('getCertOptions: não foi possível gravar PEMs em tmp:', e?.message || e);
      }
      return { cert: certBuf, key: keyBuf };
    } catch (e) {
      console.error('getCertOptions: falha ao decodificar CERT_PEM_*_BASE64:', e?.message || e);
    }
  }

  // 4) PEM via caminhos já apontados no ambiente
  const certPathEnv = process.env.CERT_PEM_CERT_PATH;
  const keyPathEnv = process.env.CERT_PEM_KEY_PATH;
  if (certPathEnv && keyPathEnv && fs.existsSync(certPathEnv) && fs.existsSync(keyPathEnv)) {
    try {
      const certBuf = fs.readFileSync(certPathEnv);
      const keyBuf = fs.readFileSync(keyPathEnv);
      return { cert: certBuf, key: keyBuf };
    } catch (e) {
      console.warn('getCertOptions: falha ao ler PEMs dos caminhos apontados:', e?.message || e);
    }
  }

  // nada encontrado
  return null;
}

class ConsultaNfeController {
 async validarConsultarNfeWizard(req, res) {
        try {
      // Carrega certificado base64 ou arquivo
      const CERTIFICADO_BASE64 =
        process.env.CERTIFICADO_BASE64 ||
        fs.readFileSync("./cert_base64.txt", "utf-8").trim();
      const SENHA = process.env.SENHA_CERTIFICADO || "#senhagto2024#";
      const CNPJ = process.env.CNPJ_EMITENTE || "99999999999999"; // ajuste para seu CNPJ

      // Salva certificado temporário
      const tempPfxPath = path.join(os.tmpdir(), "certificado.pfx");
      fs.writeFileSync(tempPfxPath, Buffer.from(CERTIFICADO_BASE64, "base64"));

      let vendas = req.body?.vendas;
      if (!vendas) {
        const response = await axios.get(
          "http://164.152.245.77:8000/quality/concentrador_homologacao/api/venda/valida-venda-contingencia.xsjs"
        );
        vendas = response.data;
      }

      // Normaliza formatos paginados/wrapped
      if (!Array.isArray(vendas)) {
        if (Array.isArray(vendas.data)) {
          vendas = vendas.data;
        } else if (Array.isArray(vendas.rows)) {
          vendas = vendas.rows;
        } else if (vendas.data && Array.isArray(vendas.data.rows)) {
          vendas = vendas.data.rows;
        } else {
          const possibleArray = Object.values(vendas).find(v => Array.isArray(v));
          if (Array.isArray(possibleArray)) {
            vendas = possibleArray;
          }
        }
      }

      if (!Array.isArray(vendas) || vendas.length === 0) {
        return res.status(400).json({ error: "Nenhuma venda para consultar." });
      }

      // Instancia e inicializa o ambiente do nfewizard-io
      const nfeWizard = new NFeWizard();
      await nfeWizard.NFE_LoadEnvironment({
        config: {
          dfe: {
            baixarXMLDistribuicao: true,
            pathXMLDistribuicao: "tmp/DistribuicaoDFe",
            armazenarXMLAutorizacao: true,
            pathXMLAutorizacao: "tmp/Autorizacao",
            armazenarXMLRetorno: true,
            pathXMLRetorno: "tmp/RequestLogs",
            armazenarXMLConsulta: true,
            pathXMLConsulta: "tmp/RequestLogs",
            armazenarXMLConsultaComTagSoap: false,
            armazenarRetornoEmJSON: true,
            pathRetornoEmJSON: "tmp/DistribuicaoDFe",
            pathCertificado: tempPfxPath,
            senhaCertificado: SENHA,
            UF: "SP", // ou row.NFE_INFNFE_EMIT_ENDEREMIT_UF se variar por venda
            CPFCNPJ: CNPJ,
          },
          nfe: {
            ambiente: 2, // 1=produção, 2=homologação
            versaoDF: "4.00",
            idCSC: 1,
            tokenCSC: '99999999-9999-9999-9999-999999999999'
          },
          lib: {
            connection: {
              timeout: 30000,
            },
          }
        }
      });

      const resultados = [];

      for (const row of vendas) {
        const IDVENDA = String(row.IDVENDA ?? "").trim();
        const UF = String(row.NFE_INFNFE_EMIT_ENDEREMIT_UF ?? "SP").trim();
        const CHAVE = String(row.CHAVE ?? "").trim();

        if (!CHAVE) {
          resultados.push({ IDVENDA, UF, error: "CHAVE ausente" });
          continue;
        }

        try {
          // Consulta por chave
          const chaveNFe = {
            cUFAutor: UF, // Ex: 35 para SP
            CNPJ: CNPJ,
            consChNFe: { chNFe: CHAVE }
          };

          console.log(chaveNFe, 'resposta NFeWizard');
          const resposta = await nfeWizard.NFE_DistribuicaoDFePorChave(chaveNFe);
          // O XML pode estar em resposta.xml, resposta.raw ou resposta.retConsSitNFe
          const xml = resposta.xml || resposta.raw || null;
          let cstat = resposta.cStat;
          if (!cstat && xml) {
            const match = String(xml).match(/<cStat>(\d+)<\/cStat>/);
            cstat = match ? match[1] : null;
          }

          resultados.push({ IDVENDA, UF, CHAVE, CSTAT: cstat, XML: xml });
        } catch (e) {
          resultados.push({ IDVENDA, UF, CHAVE, error: e.message });
        }
      }

      // Remove o arquivo temporário
      fs.unlinkSync(tempPfxPath);

      return res.json({
        total: resultados.length,
        processados: resultados.filter((r) => !r.error).length,
        data: resultados,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  
  }


 async validarConsultar(req, res) {
  try {
    const CERTIFICADO_BASE64 =
      process.env.CERTIFICADO_BASE64 ||
      fs.readFileSync("./cert_base64.txt", "utf-8").trim();

    const SENHA = process.env.SENHA_CERTIFICADO || "#senhagto2024#";

    // Salva o arquivo temporário do certificado (PFX)
    const tempPfxPath = path.join(os.tmpdir(), "certificado.pfx");
    fs.writeFileSync(tempPfxPath, Buffer.from(CERTIFICADO_BASE64, "base64"));

    let vendas = req.body?.vendas;
    if (!vendas) {
      const response = await axios.get(
        "http://164.152.245.77:8000/quality/concentrador_homologacao/api/venda/valida-venda-contingencia.xsjs"
      );
      vendas = response.data;
    }
    
    // Normaliza formatos paginados/wrapped: { data: [...] } ou { rows: [...] } ou { page, data: [...] }
    if (!Array.isArray(vendas)) {
      if (Array.isArray(vendas.data)) {
        vendas = vendas.data;
      } else if (Array.isArray(vendas.rows)) {
        vendas = vendas.rows;
      } else if (vendas.data && Array.isArray(vendas.data.rows)) {
        vendas = vendas.data.rows;
      } else {
        // tenta encontrar a primeira propriedade que é array
        const possibleArray = Object.values(vendas).find(v => Array.isArray(v));
        if (Array.isArray(possibleArray)) {
          vendas = possibleArray;
        }
      }
    }

    if (!Array.isArray(vendas) || vendas.length === 0) {
      return res.status(400).json({ error: "Nenhuma venda para consultar." });
    }

    const certOptions = {
      pfx: fs.readFileSync(tempPfxPath),
      senha: SENHA,
    };

    const resultados = [];

    for (const row of vendas) {
      const IDVENDA = String(row.IDVENDA ?? "").trim();
      const UF = String(row.NFE_INFNFE_EMIT_ENDEREMIT_UF ?? "").trim();
      const CHAVE = String(row.CHAVE ?? "").trim();

      if (!CHAVE) {
        resultados.push({ IDVENDA, UF, error: "CHAVE ausente" });
        continue;
      }

      try {
        const tools = new Tools(
          {
            mod: "55",
            tpAmb: 1,
            UF,
            versao: "4.00",
      
            xmllint: path.resolve("./libs/libxml/bin/xmllint.exe"),
          },
          certOptions
        );

        const resposta = await tools.consultarNFe(CHAVE);
       
        const xml = resposta ?? null;
        const cstat =
          resposta?.retConsSitNFe?.cStat ??
          (xml?.match(/<cStat>(\d+)<\/cStat>/)?.[1] ?? null);

        resultados.push({ IDVENDA, UF, CHAVE, CSTAT: cstat, XML: xml });
      } catch (e) {
        resultados.push({ IDVENDA, UF, CHAVE, error: e.message });
      }
    }

    // remove o arquivo temporário
    fs.unlinkSync(tempPfxPath);

    return res.json({
      total: resultados.length,
      processados: resultados.filter((r) => !r.error).length,
      data: resultados,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
 } 

}

export default new ConsultaNfeController();