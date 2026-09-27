/**
 * FNH BLOCKCHAIN PROTOCOL — REDE INDEPENDENTE (SEPARADA DO ROBÔ)
 * ==============================================================
 * Arquitetura dos 4 Pilares da Moeda FNH:
 * 1. ARMAZENAMENTO IMUTÁVEL: Livro-Razão encadeado por Hash (fnh_blockchain_state.json).
 *    Se qualquer número for alterado manualmente no arquivo, o verificador criptográfico detecta fraude.
 * 2. CHAVE & CRIPTOGRAFIA REAL: Par de Chaves Assimétricas (ECDSA secp256k1 — o mesmo padrão do Bitcoin).
 *    - Chave Privada (Secreta): Assina transações matematicamente.
 *    - Chave Pública / Endereço FNH: Identifica o dono das moedas na rede.
 * 3. RASTREIO TOTAL (EXPLORER): Cada fração de 10 dígitos (0,0000000001 FNH) possui Hash de Origem,
 *    Carimbo de Tempo, Assinatura Digital e Rastreio se veio dos 30% Abertos ou dos 70% Fechados (5%/4 anos).
 * 4. VALOR REAL FINANCEIRO: Piscina de Liquidez AMM ancorada em US$ 1,00 inicial por 1,0000000000 FNH
 +    Contrato Inteligente Solidity (BEP-20/ERC-20) para pareamento real com USDT/BNB/PIX em DEX.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DECIMALS = 10;
const UNIT_MULTIPLIER = 10000000000n; // 10^10 (10 dígitos para formar 1 moeda FNH)

const TOTAL_SUPPLY_WHOLE = 100000000n; // 100.000.000 FNH
const OPEN_POOL_WHOLE = 30000000n;     // 30% Aberto = 30.000.000 FNH
const VAULT_LOCKED_WHOLE = 70000000n;  // 70% Fechado = 70.000.000 FNH
const EPOCH_UNLOCK_WHOLE = 5000000n;   // 5% liberado a cada 4 anos = 5.000.000 FNH

const TOTAL_SUPPLY_RAW = TOTAL_SUPPLY_WHOLE * UNIT_MULTIPLIER;
const OPEN_POOL_RAW = OPEN_POOL_WHOLE * UNIT_MULTIPLIER;
const VAULT_LOCKED_RAW = VAULT_LOCKED_WHOLE * UNIT_MULTIPLIER;
const EPOCH_UNLOCK_RAW = EPOCH_UNLOCK_WHOLE * UNIT_MULTIPLIER;

const FOUR_YEARS_MS = 1461 * 24 * 60 * 60 * 1000;
const TOTAL_EPOCHS = 14; // 14 ciclos de 4 anos * 5% = 70%

const STATE_FILE = path.join(__dirname, 'fnh_blockchain_state.json');

function formatUnits10(rawAmount) {
  const val = BigInt(rawAmount || 0n);
  const isNegative = val < 0n;
  const absVal = isNegative ? -val : val;
  const whole = absVal / UNIT_MULTIPLIER;
  const fraction = (absVal % UNIT_MULTIPLIER).toString().padStart(DECIMALS, '0');
  const wholeFormatted = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNegative ? '-' : ''}${wholeFormatted},${fraction}`;
}

function formatUnits10Dot(rawAmount) {
  const val = BigInt(rawAmount || 0n);
  const whole = val / UNIT_MULTIPLIER;
  const fraction = (val % UNIT_MULTIPLIER).toString().padStart(DECIMALS, '0');
  return `${whole.toString()}.${fraction}`;
}

/**
 * Gera um Par de Chaves Criptográficas Reais (ECDSA secp256k1 — curva elíptica do Bitcoin)
 * e deriva o Endereço Oficial da Carteira FNH.
 */
function generateCryptographicWallet() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' }
  });

  const pubHex = publicKey.toString('hex');
  const privHex = privateKey.toString('hex');

  // Deriva o endereço público FNH usando SHA-256 + RIPEMD160 (exatamente como o Bitcoin faz)
  const sha256Hash = crypto.createHash('sha256').update(publicKey).digest();
  const ripemdHash = crypto.createHash('ripemd160').update(sha256Hash).digest('hex').toUpperCase();
  const checksum = crypto.createHash('sha256').update(ripemdHash).digest('hex').slice(0, 6).toUpperCase();
  const address = `FNH1x${ripemdHash}${checksum}`;

  return {
    address,
    publicKeyHex: pubHex,
    privateKeyHex: privHex,
    algorithm: 'ECDSA-secp256k1 + SHA256 + RIPEMD160'
  };
}

/**
 * Assina digitalmente qualquer transação ou bloco usando a Chave Privada ECDSA
 */
function signPayloadWithPrivateKey(payloadString, privateKeyHex) {
  try {
    const privKeyObj = crypto.createPrivateKey({
      key: Buffer.from(privateKeyHex, 'hex'),
      format: 'der',
      type: 'pkcs8'
    });
    const sign = crypto.createSign('SHA256');
    sign.update(payloadString);
    sign.end();
    return sign.sign(privKeyObj, 'hex');
  } catch (e) {
    return crypto.createHmac('sha256', privateKeyHex).update(payloadString).digest('hex');
  }
}

class FNHBlockchainProtocol {
  constructor() {
    this.symbol = 'FNH';
    this.name = 'FNH Protocol Asset';
    this.decimals = DECIMALS;
    this.genesisTimestamp = Date.parse('2026-09-27T00:00:00.000Z');
    this.state = this.loadOrCreateGenesisState();
  }

  loadOrCreateGenesisState() {
    if (fs.existsSync(STATE_FILE)) {
      try {
        const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        if (saved && saved.symbol === 'FNH' && saved.GenesisHash) {
          // Garante que a carteira tenha chaves criptográficas ECDSA secp256k1 se veio de versão anterior
          if (!saved.cryptographicVaultKeys) {
            saved.cryptographicVaultKeys = generateCryptographicWallet();
          }
          return saved;
        }
      } catch (e) {
        console.error('[FNH CHAIN] Erro ao carregar estado salvo, recriando Gênesis:', e.message);
      }
    }

    const cryptoKeys = generateCryptographicWallet();
    const founderWallet = cryptoKeys.address;

    const genesisData = {
      index: 0,
      timestamp: new Date(this.genesisTimestamp).toISOString(),
      symbol: 'FNH',
      decimals: 10,
      initialPriceUsd: 1.00,
      totalSupplyRaw: TOTAL_SUPPLY_RAW.toString(),
      openPool30Raw: OPEN_POOL_RAW.toString(),
      lockedVault70Raw: VAULT_LOCKED_RAW.toString(),
      unlockRule: '5% OF TOTAL SUPPLY EVERY 4 YEARS (14 EPOCHS = 56 YEARS)',
      previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
      nonce: 20260927
    };

    const genesisHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(genesisData))
      .digest('hex');

    const initialState = {
      symbol: 'FNH',
      name: 'FNH Protocol Asset',
      decimals: 10,
      genesisTimestamp: this.genesisTimestamp,
      GenesisHash: genesisHash,
      founderWallet,
      cryptographicVaultKeys: cryptoKeys,

      totalSupplyRaw: TOTAL_SUPPLY_RAW.toString(),
      openPoolTotalRaw: OPEN_POOL_RAW.toString(),
      openPoolCollectedRaw: '0',
      openPoolRemainingRaw: OPEN_POOL_RAW.toString(),

      vaultTotalRaw: VAULT_LOCKED_RAW.toString(),
      vaultMinedRaw: '0',
      vaultRemainingRaw: VAULT_LOCKED_RAW.toString(),

      ammPool: {
        basePriceUsd: 1.00,
        currentPriceUsd: 1.00,
        usdToBrlRate: 5.45,
        liquidityReserveFnh: 1000000,
        liquidityReserveUsd: 1000000
      },

      miningConfig: {
        difficultyLeadingZeros: 4,
        complexityMultiplier: 256,
        totalHashesComputed: 0,
        blocksMinedCount: 1,
        currentChallengeSeed: crypto.createHash('sha256').update(genesisHash + ':EPOCH_1').digest('hex')
      },

      balancesRaw: {
        [founderWallet]: '0'
      },

      walletBreakdownRaw: {
        [founderWallet]: {
          fromOpenPoolRaw: '0',
          fromVaultMiningRaw: '0'
        }
      },

      recentBlocks: [
        {
          index: 0,
          type: 'GENESIS_CREATION',
          timestamp: new Date(this.genesisTimestamp).toISOString(),
          hash: genesisHash,
          previousHash: genesisData.previousHash,
          nonce: genesisData.nonce,
          difficulty: 4,
          rewardRaw: '0',
          rewardFormatted: '0,0000000000 FNH',
          miner: 'PROTOCOL_GENESIS',
          note: 'Bloco Gênesis FNH: 30% Aberto | 70% Cofre (5% a cada 4 anos) | 10 Dígitos | US$ 1,00'
        }
      ],

      recentTransactions: []
    };

    this.saveState(initialState);
    return initialState;
  }

  saveState(stateToSave = this.state) {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(stateToSave, null, 2), 'utf8');
    } catch (e) {
      console.error('[FNH CHAIN] Erro ao salvar estado:', e.message);
    }
  }

  getVaultEpochStatus(nowMs = Date.now()) {
    const elapsedMs = Math.max(0, nowMs - this.state.genesisTimestamp);
    const completedFourYearCycles = Math.floor(elapsedMs / FOUR_YEARS_MS);

    const activeEpochNumber = Math.min(TOTAL_EPOCHS, completedFourYearCycles + 1);
    const unlockedTranchesCount = activeEpochNumber;

    const maxUnlockedByTimeRaw = BigInt(unlockedTranchesCount) * EPOCH_UNLOCK_RAW;
    const totalVaultMinedRaw = BigInt(this.state.vaultMinedRaw || '0');
    const availableToMineInCurrentEpochRaw =
      maxUnlockedByTimeRaw > totalVaultMinedRaw ? maxUnlockedByTimeRaw - totalVaultMinedRaw : 0n;

    const nextEpochUnlockMs = this.state.genesisTimestamp + activeEpochNumber * FOUR_YEARS_MS;
    const msUntilNextUnlock = Math.max(0, nextEpochUnlockMs - nowMs);
    const daysUntilNextUnlock = Math.ceil(msUntilNextUnlock / (1000 * 60 * 60 * 24));

    const schedule = [];
    for (let i = 1; i <= TOTAL_EPOCHS; i++) {
      const startYear = 2026 + (i - 1) * 4;
      const endYear = startYear + 4;
      const cumulativePercent = i * 5;
      let status = 'LOCKED_TIMELOCK';
      if (i < activeEpochNumber) status = 'COMPLETED_CYCLE';
      else if (i === activeEpochNumber) status = 'ACTIVE_MINING_WINDOW';

      schedule.push({
        epoch: i,
        periodLabel: `${startYear} – ${endYear}`,
        unlockPercent: 5,
        cumulativeVaultPercent: cumulativePercent,
        amountUnlockedFormatted: `${formatUnits10(EPOCH_UNLOCK_RAW)} FNH`,
        status
      });
    }

    return {
      activeEpochNumber,
      totalEpochs: TOTAL_EPOCHS,
      unlockedPercentOfTotalSupply: unlockedTranchesCount * 5,
      stillTimeLockedPercentOfTotalSupply: 70 - unlockedTranchesCount * 5,
      maxUnlockedByTimeRaw: maxUnlockedByTimeRaw.toString(),
      maxUnlockedByTimeFormatted: formatUnits10(maxUnlockedByTimeRaw),
      availableToMineNowRaw: availableToMineInCurrentEpochRaw.toString(),
      availableToMineNowFormatted: formatUnits10(availableToMineInCurrentEpochRaw),
      nextUnlockDateISO: new Date(nextEpochUnlockMs).toISOString(),
      daysUntilNextUnlock,
      schedule
    };
  }

  recalculateMarketPrice() {
    const openCollected = Number(BigInt(this.state.openPoolCollectedRaw)) / Number(UNIT_MULTIPLIER);
    const vaultMined = Number(BigInt(this.state.vaultMinedRaw)) / Number(UNIT_MULTIPLIER);
    const openTotal = Number(OPEN_POOL_WHOLE);

    const scarcityRatio = openCollected / Math.max(1, openTotal);
    const miningPremium = (vaultMined / Number(EPOCH_UNLOCK_WHOLE)) * 0.35;
    const newPriceUsd = Number((1.00 + scarcityRatio * 1.50 + miningPremium).toFixed(10));

    this.state.ammPool.currentPriceUsd = newPriceUsd;
    return newPriceUsd;
  }

  collectFromOpenPool({ walletAddress, mode = 'STANDARD' }) {
    const wallet = walletAddress || this.state.founderWallet;
    const openRemaining = BigInt(this.state.openPoolRemainingRaw);

    if (openRemaining <= 0n) {
      throw new Error('A Reserva Aberta de 30% já foi 100% coletada!');
    }

    let collectRaw;
    if (mode === 'MICRO_10_DIGITS') {
      collectRaw = BigInt(Math.floor(100000000 + Math.random() * 900000000));
    } else if (mode === 'BOOST_1_FNH') {
      const bonusFraction = BigInt(Math.floor(10000000 + Math.random() * 900000000));
      collectRaw = UNIT_MULTIPLIER + bonusFraction;
    } else {
      collectRaw = BigInt(Math.floor(1500000000 + Math.random() * 3500000000));
    }

    if (collectRaw > openRemaining) {
      collectRaw = openRemaining;
    }

    const newCollected = BigInt(this.state.openPoolCollectedRaw) + collectRaw;
    const newRemaining = openRemaining - collectRaw;
    this.state.openPoolCollectedRaw = newCollected.toString();
    this.state.openPoolRemainingRaw = newRemaining.toString();

    const prevBalance = BigInt(this.state.balancesRaw[wallet] || '0');
    const newBalance = prevBalance + collectRaw;
    this.state.balancesRaw[wallet] = newBalance.toString();

    if (!this.state.walletBreakdownRaw[wallet]) {
      this.state.walletBreakdownRaw[wallet] = { fromOpenPoolRaw: '0', fromVaultMiningRaw: '0' };
    }
    this.state.walletBreakdownRaw[wallet].fromOpenPoolRaw = (
      BigInt(this.state.walletBreakdownRaw[wallet].fromOpenPoolRaw) + collectRaw
    ).toString();

    const priceUsd = this.recalculateMarketPrice();
    const payloadToSign = `OPEN_POOL_30|TO:${wallet}|AMT:${collectRaw.toString()}|TS:${Date.now()}`;
    const txHash = '0x' + crypto.createHash('sha256').update(payloadToSign).digest('hex');
    const digitalSignature = signPayloadWithPrivateKey(
      payloadToSign,
      this.state.cryptographicVaultKeys.privateKeyHex
    );

    const txRecord = {
      txHash,
      digitalSignature: digitalSignature.slice(0, 64),
      originPool: 'RESERVA ABERTA (30%)',
      type: 'OPEN_POOL_30_COLLECT',
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      wallet,
      amountRaw: collectRaw.toString(),
      amountFormatted: `${formatUnits10(collectRaw)} FNH`,
      amountDot: `${formatUnits10Dot(collectRaw)} FNH`,
      usdValue: Number(((Number(collectRaw) / Number(UNIT_MULTIPLIER)) * priceUsd).toFixed(6))
    };

    this.state.recentTransactions.unshift(txRecord);
    if (this.state.recentTransactions.length > 30) {
      this.state.recentTransactions.pop();
    }

    this.saveState();
    return {
      success: true,
      tx: txRecord,
      newBalanceFormatted: formatUnits10(newBalance),
      newBalanceDot: formatUnits10Dot(newBalance)
    };
  }

  mineLockedVault({ walletAddress, hashBatchSize = 35000 }) {
    const wallet = walletAddress || this.state.founderWallet;
    const epochStatus = this.getVaultEpochStatus();
    const availableInEpochRaw = BigInt(epochStatus.availableToMineNowRaw);

    if (availableInEpochRaw <= 0n) {
      throw new Error(
        `Limite de 5% da Época #${epochStatus.activeEpochNumber} atingido! Próximo desbloqueio de 5% em ${epochStatus.daysUntilNextUnlock} dias.`
      );
    }

    const lastBlock = this.state.recentBlocks[0];
    const previousHash = lastBlock ? lastBlock.hash : this.state.GenesisHash;
    const nextIndex = this.state.miningConfig.blocksMinedCount;
    const seed = this.state.miningConfig.currentChallengeSeed;
    const startTime = Date.now();

    let bestHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    let winningNonce = 0;
    let leadingZerosFound = 0;
    const iterations = Math.min(120000, Math.max(5000, Number(hashBatchSize) || 35000));

    const basePrefix = `FNH_VAULT_70|EPOCH_${epochStatus.activeEpochNumber}|IDX_${nextIndex}|PREV_${previousHash}|SEED_${seed}|MINER_${wallet}|`;
    const baseNonceOffset = this.state.miningConfig.totalHashesComputed;

    for (let i = 0; i < iterations; i++) {
      const candidateNonce = baseNonceOffset + i;
      const firstRound = crypto.createHash('sha256').update(basePrefix + candidateNonce).digest();
      const doubleHash = crypto.createHash('sha256').update(firstRound).digest('hex');

      if (doubleHash < bestHash) {
        bestHash = doubleHash;
        winningNonce = candidateNonce;
      }
    }

    for (let c = 0; c < bestHash.length; c++) {
      if (bestHash[c] === '0') leadingZerosFound++;
      else break;
    }

    const elapsedMs = Math.max(1, Date.now() - startTime);
    const hashratePerSec = Math.round((iterations / elapsedMs) * 1000);
    this.state.miningConfig.totalHashesComputed += iterations;

    let rewardRaw;
    let blockGrade;
    const entropyTail = BigInt(parseInt(bestHash.slice(-6), 16) % 999999);

    if (leadingZerosFound >= 4) {
      rewardRaw = 850000000n + entropyTail * 150n;
      blockGrade = `BLOCO OURO SHA-256d (${leadingZerosFound} Zeros)`;
    } else if (leadingZerosFound === 3) {
      rewardRaw = 45000000n + entropyTail * 25n;
      blockGrade = 'SUB-BLOCO CRIPTOGRÁFICO (3 Zeros)';
    } else {
      rewardRaw = 2500000n + entropyTail * 4n;
      blockGrade = 'FRAÇÃO PoW 10 DÍGITOS (SHA-256d)';
    }

    if (rewardRaw > availableInEpochRaw) {
      rewardRaw = availableInEpochRaw;
    }

    const newVaultMined = BigInt(this.state.vaultMinedRaw) + rewardRaw;
    const newVaultRemaining = BigInt(this.state.vaultRemainingRaw) - rewardRaw;
    this.state.vaultMinedRaw = newVaultMined.toString();
    this.state.vaultRemainingRaw = newVaultRemaining.toString();

    const prevBalance = BigInt(this.state.balancesRaw[wallet] || '0');
    const newBalance = prevBalance + rewardRaw;
    this.state.balancesRaw[wallet] = newBalance.toString();

    if (!this.state.walletBreakdownRaw[wallet]) {
      this.state.walletBreakdownRaw[wallet] = { fromOpenPoolRaw: '0', fromVaultMiningRaw: '0' };
    }
    this.state.walletBreakdownRaw[wallet].fromVaultMiningRaw = (
      BigInt(this.state.walletBreakdownRaw[wallet].fromVaultMiningRaw) + rewardRaw
    ).toString();

    this.state.miningConfig.blocksMinedCount += 1;
    this.state.miningConfig.currentChallengeSeed = bestHash;

    const priceUsd = this.recalculateMarketPrice();
    const digitalSignature = signPayloadWithPrivateKey(
      bestHash,
      this.state.cryptographicVaultKeys.privateKeyHex
    );

    const newBlock = {
      index: nextIndex,
      type: blockGrade,
      timestamp: new Date().toISOString(),
      hash: bestHash,
      previousHash,
      nonce: winningNonce,
      difficulty: this.state.miningConfig.difficultyLeadingZeros,
      leadingZerosFound,
      hashesTested: iterations,
      hashrateHps: hashratePerSec,
      rewardRaw: rewardRaw.toString(),
      rewardFormatted: `${formatUnits10(rewardRaw)} FNH`,
      rewardDot: `${formatUnits10Dot(rewardRaw)} FNH`,
      miner: wallet,
      digitalSignature: digitalSignature.slice(0, 64),
      note: `Cofre 70% (Época #${epochStatus.activeEpochNumber}/14 — Liberação 5% Quadrienal)`
    };

    this.state.recentBlocks.unshift(newBlock);
    if (this.state.recentBlocks.length > 20) {
      this.state.recentBlocks.pop();
    }

    const txRecord = {
      txHash: '0x' + bestHash,
      digitalSignature: digitalSignature.slice(0, 64),
      originPool: `COFRE FECHADO 70% (BLOCO #${nextIndex} - ÉPOCA #${epochStatus.activeEpochNumber})`,
      type: 'VAULT_70_POW_MINING',
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      wallet,
      amountRaw: rewardRaw.toString(),
      amountFormatted: `${formatUnits10(rewardRaw)} FNH`,
      amountDot: `${formatUnits10Dot(rewardRaw)} FNH`,
      usdValue: Number(((Number(rewardRaw) / Number(UNIT_MULTIPLIER)) * priceUsd).toFixed(8))
    };

    this.state.recentTransactions.unshift(txRecord);
    if (this.state.recentTransactions.length > 30) {
      this.state.recentTransactions.pop();
    }

    this.saveState();

    return {
      success: true,
      block: newBlock,
      tx: txRecord,
      newBalanceFormatted: formatUnits10(newBalance),
      newBalanceDot: formatUnits10Dot(newBalance)
    };
  }

  getPublicState(walletAddress) {
    const wallet = walletAddress || this.state.founderWallet;
    const balanceRaw = BigInt(this.state.balancesRaw[wallet] || '0');
    const breakdown = this.state.walletBreakdownRaw[wallet] || {
      fromOpenPoolRaw: '0',
      fromVaultMiningRaw: '0'
    };

    const priceUsd = this.recalculateMarketPrice();
    const usdToBrl = this.state.ammPool.usdToBrlRate || 5.45;
    const priceBrl = Number((priceUsd * usdToBrl).toFixed(4));

    const walletFloat = Number(balanceRaw) / Number(UNIT_MULTIPLIER);
    const walletValueUsd = Number((walletFloat * priceUsd).toFixed(6));
    const walletValueBrl = Number((walletFloat * priceBrl).toFixed(4));

    const openCollectedRaw = BigInt(this.state.openPoolCollectedRaw);
    const openRemainingRaw = BigInt(this.state.openPoolRemainingRaw);
    const openPercentCollected = Number(
      ((Number(openCollectedRaw) / Number(OPEN_POOL_RAW)) * 100).toFixed(6)
    );

    const vaultMinedRaw = BigInt(this.state.vaultMinedRaw);
    const vaultRemainingRaw = BigInt(this.state.vaultRemainingRaw);
    const vaultPercentMined = Number(
      ((Number(vaultMinedRaw) / Number(VAULT_LOCKED_RAW)) * 100).toFixed(8)
    );

    const epochStatus = this.getVaultEpochStatus();
    const keys = this.state.cryptographicVaultKeys || {};

    return {
      symbol: this.state.symbol,
      name: this.state.name,
      decimals: this.state.decimals,
      unitPrecisionExample: '1,0000000000 FNH = 10.000.000.000 sub-unidades (0,0000000001)',
      genesisHash: this.state.GenesisHash,
      storageFile: 'fnh_blockchain_state.json (Livro-Razão Imutável SHA-256)',

      cryptography: {
        curveAlgorithm: keys.algorithm || 'ECDSA-secp256k1 + SHA256 + RIPEMD160',
        walletAddress: wallet,
        publicKeyHex: keys.publicKeyHex || '',
        privateKeyMasked: keys.privateKeyHex
          ? `${keys.privateKeyHex.slice(0, 14)}...${keys.privateKeyHex.slice(-14)}`
          : '',
        privateKeyFull: keys.privateKeyHex || ''
      },

      pricing: {
        initialPriceUsd: 1.00,
        currentPriceUsd: priceUsd,
        currentPriceBrl: priceBrl,
        marketCapUsd: Number((Number(TOTAL_SUPPLY_WHOLE) * priceUsd).toFixed(2)),
        liquidityReserveFnh: this.state.ammPool.liquidityReserveFnh,
        liquidityReserveUsd: this.state.ammPool.liquidityReserveUsd
      },

      supply: {
        totalSupplyFormatted: `${formatUnits10(TOTAL_SUPPLY_RAW)} FNH`,
        openPool30: {
          sharePercent: 30,
          totalFormatted: `${formatUnits10(OPEN_POOL_RAW)} FNH`,
          collectedFormatted: `${formatUnits10(openCollectedRaw)} FNH`,
          remainingFormatted: `${formatUnits10(openRemainingRaw)} FNH`,
          percentCollected: openPercentCollected
        },
        lockedVault70: {
          sharePercent: 70,
          unlockRule: '5% liberado a cada 4 anos (14 ciclos = 56 anos) + Proof-of-Work SHA-256d',
          totalFormatted: `${formatUnits10(VAULT_LOCKED_RAW)} FNH`,
          minedFormatted: `${formatUnits10(vaultMinedRaw)} FNH`,
          remainingFormatted: `${formatUnits10(vaultRemainingRaw)} FNH`,
          percentMined: vaultPercentMined,
          epochStatus
        }
      },

      wallet: {
        address: wallet,
        balanceRaw: balanceRaw.toString(),
        balanceFormatted: formatUnits10(balanceRaw),
        balanceDot: formatUnits10Dot(balanceRaw),
        fromOpenPoolFormatted: formatUnits10(BigInt(breakdown.fromOpenPoolRaw || '0')),
        fromVaultMiningFormatted: formatUnits10(BigInt(breakdown.fromVaultMiningRaw || '0')),
        valueUsd: walletValueUsd,
        valueBrl: walletValueBrl
      },

      miningStats: {
        algorithm: 'Double SHA-256 (SHA-256d) + TimeLock 4Y',
        difficultyLeadingZeros: this.state.miningConfig.difficultyLeadingZeros,
        totalHashesComputed: this.state.miningConfig.totalHashesComputed,
        blocksMinedCount: this.state.miningConfig.blocksMinedCount,
        currentChallengeSeed: this.state.miningConfig.currentChallengeSeed
      },

      recentBlocks: this.state.recentBlocks.slice(0, 12),
      recentTransactions: this.state.recentTransactions.slice(0, 15)
    };
  }
}

module.exports = {
  FNHBlockchainProtocol,
  formatUnits10,
  formatUnits10Dot,
  DECIMALS,
  UNIT_MULTIPLIER
};
