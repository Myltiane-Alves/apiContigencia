import { Tools } from 'node-sped-nfe';
import fs from 'fs';
import xlsx from 'xlsx';
import path from 'path';
import archiver from 'archiver';
import axios from 'axios';
import os from 'os';
import dotenv from 'dotenv';

dotenv.config();
function extrairCStat(xml) {
  const match = String(xml).match(/<cStat>(\d+)<\/cStat>/);
  return match ? match[1] : 'SEM_CSTAT';
}

class ConsultaNfeController {

  async validarConsultar(req, res) {
  try {
    const CERTIFICADO_BASE64 = process.env.CERTIFICADO_BASE64 
    if (!CERTIFICADO_BASE64) {
  throw new Error("CERTIFICADO_BASE64 não definido nas variáveis de ambiente");
}

    const SENHA = process.env.SENHA_CERTIFICADO || "#senhagto2024#";

    // Salva o arquivo temporário do certificado (PFX)
    const tempPfxPath = path.join(os.tmpdir(), "certificado.pfx");
    fs.writeFileSync(tempPfxPath, Buffer.from(CERTIFICADO_BASE64, "base64"));

    let vendas = req.body?.vendas;
    if (!vendas) {
      const response = await axios.get(
        "http://164.152.245.77:8000/quality/concentrador/api/venda/valida-venda-contingencia.xsjs"
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