
// import http from "http";
// import express from "express";
// import fs from "fs";
// import path from "path";
// import os from "os";
// import axios from "axios";
// import { Tools } from "node-sped-nfe";

// const app = express();
// app.use(express.json());

// app.get("/", (req, res) => {
//   res.send("Servidor NFe ativo e rodando 🚀");
// });

// function delay(ms) {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

// app.get("/validarConsulta", async (req, res) => {
//   let tempPfxPath = null;

//   try {
//     console.log("🟢 Iniciando validação de consulta...");

//     // === 1️⃣ Carrega certificado base64 ===
//     const CERTIFICADO_BASE64 =
//       process.env.CERTIFICADO_BASE64 ||
//       fs.readFileSync("./cert_base64.txt", "utf-8").trim();

//     if (!CERTIFICADO_BASE64)
//       throw new Error("CERTIFICADO_BASE64 não definido nas variáveis de ambiente");

//     const SENHA = process.env.SENHA_CERTIFICADO || "#senhagto2024#";

//     // === 2️⃣ Cria arquivo PFX temporário (necessário pelo node-sped-nfe)
//     tempPfxPath = path.join(os.tmpdir(), `cert_${Date.now()}.pfx`);
//     fs.writeFileSync(tempPfxPath, Buffer.from(CERTIFICADO_BASE64, "base64"));

//     // === 3️⃣ Busca vendas ===
//     let vendas = req.body?.vendas;
//     if (!vendas) {
//       const response = await axios.get(
//         "http://164.152.245.77:8000/quality/concentrador_homologacao/api/venda/valida-venda-contingencia.xsjs",
//         { timeout: 15000 }
//       );
//       vendas = response.data;
//     }

//     // Normaliza formatos de resposta
//     if (!Array.isArray(vendas)) {
//       if (Array.isArray(vendas.data)) vendas = vendas.data;
//       else if (Array.isArray(vendas.rows)) vendas = vendas.rows;
//       else {
//         const possibleArray = Object.values(vendas).find((v) => Array.isArray(v));
//         if (Array.isArray(possibleArray)) vendas = possibleArray;
//       }
//     }

//     if (!Array.isArray(vendas) || vendas.length === 0) {
//       return res.status(400).json({ error: "Nenhuma venda para consultar." });
//     }

//     // === 4️⃣ Configura certificado ===
//     const certOptions = {
//       pfx: fs.readFileSync(tempPfxPath),
//       senha: SENHA,
//     };

//     const resultados = [];
//     const chunkSize = 3; // processa 3 por vez para economizar RAM

//     // === 5️⃣ Processa as vendas ===
//     for (let i = 0; i < vendas.length; i += chunkSize) {
//       const chunk = vendas.slice(i, i + chunkSize);
//       console.log(`🔹 Lote ${i / chunkSize + 1} de ${Math.ceil(vendas.length / chunkSize)}`);

//       for (const row of chunk) {
//         const IDVENDA = String(row.IDVENDA ?? "").trim();
//         const UF = String(row.NFE_INFNFE_EMIT_ENDEREMIT_UF ?? row.UF ?? "SP").trim();
//         const CHAVE = String(row.CHAVE ?? "").trim();

//         if (!CHAVE) {
//           resultados.push({ IDVENDA, UF, error: "CHAVE ausente" });
//           continue;
//         }

//         try {
//           const tools = new Tools(
//             {
//               mod: "55",
//               tpAmb: 1,
//               UF,
//               versao: "4.00",
//               xmllint: path.resolve("./libs/libxml/bin/xmllint.exe"),
//             },
//             certOptions
//           );

//           const resposta = await tools.consultarNFe(CHAVE);

//           // Normaliza o XML e o cStat
//           let xmlString = null;
//           if (typeof resposta === "string") xmlString = resposta;
//           else if (resposta?.xml) xmlString = resposta.xml;
//           else if (resposta?.raw) xmlString = resposta.raw;
//           else if (resposta?.retConsSitNFe)
//             xmlString = JSON.stringify(resposta.retConsSitNFe, null, 2);

//           const cstat =
//             resposta?.retConsSitNFe?.cStat ??
//             (xmlString?.match(/<cStat>(\d+)<\/cStat>/)?.[1] ?? null);

//           resultados.push({
//             IDVENDA,
//             UF,
//             CHAVE,
//             CSTAT: cstat,
//             XML: xmlString || null,
//           });
//         } catch (e) {
//           resultados.push({ IDVENDA, UF, CHAVE, error: e.message });
//         }

//         // pequena pausa e limpeza manual de GC (se habilitado)
//         await delay(200);
//         global.gc?.();
//       }

//       // pausa entre lotes para aliviar memória
//       await delay(800);
//       global.gc?.();
//     }

//     // === 6️⃣ Retorno (somente memória) ===
//     return res.json({
//       total: resultados.length,
//       processados: resultados.filter((r) => !r.error).length,
//       erros: resultados.filter((r) => r.error).length,
//       data: resultados,
//     });
//   } catch (err) {
//     console.error("❌ Erro geral:", err);
//     return res.status(500).json({ error: err.message });
//   } finally {
//     // === 7️⃣ Limpeza final ===
//     try {
//       if (tempPfxPath && fs.existsSync(tempPfxPath)) fs.unlinkSync(tempPfxPath);
//     } catch (cleanupErr) {
//       console.warn("Erro ao remover certificado temporário:", cleanupErr.message);
//     }
//   }
// });

// // === 8️⃣ Inicializa servidor ===
// const server = http.createServer(app);
// const PORT = process.env.PORT || 6004;
// server.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
