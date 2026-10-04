const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const TOKEN = process.env.VERCEL_TOKEN || (fs.existsSync(path.join(__dirname, '.vercel_token')) ? fs.readFileSync(path.join(__dirname, '.vercel_token'), 'utf8').trim() : '');
const TEAM_ID = 'team_oUQSYs8eK43AM3fOenbmOrQE';
const PROJECT_ID = 'prj_E8lVWOd85J7pCfPoJtMyKquV7jsA';
const PROJECT_NAME = 'nexus-darwin-ai';

function requestApi(urlPath, method, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, 'https://api.vercel.com');
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let data = Buffer.alloc(0);
      res.on('data', chunk => { data = Buffer.concat([data, chunk]); });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data.toString('utf8')) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data.toString('utf8') });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function uploadFile(buffer, sha) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.vercel.com',
      path: `/v2/files?teamId=${TEAM_ID}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': buffer.length,
        'x-vercel-digest': sha
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

function collectFiles(dir, baseDir = '') {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.join(baseDir, entry.name).replace(/\\/g, '/');

    // Ignora pastas pesadas e desnecessárias
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.firebase', 'tmp', 'brain'].includes(entry.name)) continue;
      results = results.concat(collectFiles(fullPath, relPath));
    } else {
      if (['.env', '.env.local', 'package-lock.json'].includes(entry.name)) continue;
      if (entry.name.endsWith('.log') || entry.name.endsWith('.bat')) continue;
      results.push({ fullPath, relPath });
    }
  }
  return results;
}

async function main() {
  console.log('🚀 [VERCEL DIRECT DEPLOY] Iniciando upload de produção direto na Vercel...');
  console.log(`📁 Projeto: ${PROJECT_NAME} (${PROJECT_ID})`);

  const filesList = collectFiles(__dirname);
  console.log(`📦 Coletados ${filesList.length} arquivos locais para publicação.`);

  const deploymentFiles = [];

  for (const f of filesList) {
    const content = fs.readFileSync(f.fullPath);
    const sha = crypto.createHash('sha1').update(content).digest('hex');

    deploymentFiles.push({
      file: f.relPath,
      sha: sha,
      size: content.length
    });

    // Faz upload do arquivo
    const up = await uploadFile(content, sha);
    if (up.status === 200 || up.status === 201) {
      console.log(`   ✓ [OK] ${f.relPath} (${(content.length / 1024).toFixed(1)} KB)`);
    } else {
      console.log(`   ℹ [STATUS ${up.status}] ${f.relPath}`);
    }
  }

  console.log('\n⚡ Criando Deployment de Produção no endpoint oficial /v13/deployments...');

  const deployPayload = {
    name: PROJECT_NAME,
    project: PROJECT_ID,
    target: 'production',
    files: deploymentFiles
  };

  const deployRes = await requestApi(
    `/v13/deployments?teamId=${TEAM_ID}`,
    'POST',
    { 'Content-Type': 'application/json' },
    JSON.stringify(deployPayload)
  );

  if (deployRes.status !== 200 && deployRes.status !== 201) {
    console.error('❌ Erro ao criar deployment:', deployRes.status, deployRes.data);
    process.exit(1);
  }

  const deployment = deployRes.data;
  console.log(`\n🎉 DEPLOYMENT CRIADO COM SUCESSO!`);
  console.log(`   ID: ${deployment.id}`);
  console.log(`   URL do Deploy: https://${deployment.url}`);
  console.log(`   Estado Atual: ${deployment.readyState || deployment.status}`);

  console.log('\n⏳ Aguardando conclusão do build e ativação dos domínios de produção...');
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const check = await requestApi(`/v13/deployments/${deployment.id}?teamId=${TEAM_ID}`, 'GET');
    const state = check.data?.readyState || check.data?.status;
    console.log(`   [${i + 1}] Status: ${state}`);
    if (state === 'READY') {
      ready = true;
      break;
    }
    if (state === 'ERROR' || state === 'CANCELED') {
      console.error('❌ Falha no build da Vercel:', check.data);
      process.exit(1);
    }
  }

  if (ready) {
    console.log('\n======================================================');
    console.log('✅ PUBLICAÇÃO EM PRODUÇÃO 100% CONCLUÍDA!');
    console.log('   Domínio Principal: https://nexus-darwin-ai.vercel.app/');
    console.log('   Página da Alpaca:  https://nexus-darwin-ai.vercel.app/alpaca.html');
    console.log('======================================================');
  }
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
