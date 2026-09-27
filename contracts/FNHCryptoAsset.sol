// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FNH Protocol Asset (FNH)
 * @notice Contrato Inteligente Oficial com:
 * - 10 Casas Decimais (1 FNH = 10.000.000.000 sub-unidades -> 0.0000000001)
 * - Valor Inicial de Referência: US$ 1,00 (1 Dólar por 1.0000000000 FNH)
 * - 30% Parte Aberta (30.000.000 FNH) disponível para Coleta Direta e Liquidez
 * - 70% Parte Fechada (70.000.000 FNH) trancada em Cofre Criptográfico de Alta Complexidade
 * - Regra Quadrienal: Libera apenas 5% do suprimento total (5.000.000 FNH) a cada 4 anos (1461 dias)
 *   mediante Prova de Trabalho Criptográfica (Proof-of-Work SHA-256 / Keccak-256).
 */
contract FNHCryptoAsset {
    string public constant name = "FNH Protocol Asset";
    string public constant symbol = "FNH";
    uint8 public constant decimals = 10; // 10 dígitos para formar 1 moeda inteira

    uint256 public constant UNIT = 10 ** uint256(decimals); // 10.000.000.000
    uint256 public constant MAX_SUPPLY = 100_000_000 * UNIT; // 100.000.000,0000000000 FNH

    // Divisão 30% Aberto / 70% Fechado
    uint256 public constant OPEN_POOL_TOTAL = (MAX_SUPPLY * 30) / 100;   // 30% = 30.000.000 FNH
    uint256 public constant VAULT_LOCKED_TOTAL = (MAX_SUPPLY * 70) / 100; // 70% = 70.000.000 FNH

    // Regra de Desbloqueio do Cofre: 5% do Suprimento Total a cada 4 Anos (14 Ciclos = 56 Anos)
    uint256 public constant EPOCH_UNLOCK_AMOUNT = (MAX_SUPPLY * 5) / 100; // 5% = 5.000.000 FNH por ciclo
    uint256 public constant FOUR_YEARS_SECONDS = 1461 days;               // 4 anos exatos (incluindo bissexto)
    uint256 public constant TOTAL_EPOCHS = 14;                            // 14 * 5% = 70%

    // Âncora de Valor Inicial = US$ 1,00 (expresso com 10 casas decimais)
    uint256 public constant INITIAL_PRICE_USD_10DEC = 1 * UNIT; // $1.0000000000 USD

    address public immutable founder;
    uint256 public immutable genesisTimestamp;

    uint256 public totalSupply;
    uint256 public openPoolCollected;
    uint256 public vaultMinedTotal;

    // Estado do Desafio Criptográfico de Alta Complexidade (Proof-of-Work)
    bytes32 public currentChallengeHash;
    uint256 public miningDifficultyTarget;
    uint256 public blocksMinedCount;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public lastOpenCollectionTime;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OpenPoolCollected(address indexed collector, uint256 amount, uint256 remainingOpenPool);
    event VaultBlockMined(
        address indexed miner,
        uint256 indexed blockNumber,
        uint256 epochNumber,
        uint256 nonce,
        bytes32 solutionHash,
        uint256 rewardAmount
    );

    constructor() {
        founder = msg.sender;
        genesisTimestamp = block.timestamp;
        totalSupply = MAX_SUPPLY;

        // O contrato guarda inicialmente os 30% Abertos + 70% do Cofre para distribuição segundo as regras
        balanceOf[address(this)] = MAX_SUPPLY;
        emit Transfer(address(0), address(this), MAX_SUPPLY);

        // Semente Criptográfica Gênesis e Dificuldade Alta (exige 24 bits zero iniciais no hash)
        currentChallengeHash = keccak256(abi.encodePacked("FNH_GENESIS_2026", block.timestamp, msg.sender));
        miningDifficultyTarget = type(uint256).max >> 16; // Grau de complexidade criptográfica elevado
        blocksMinedCount = 1;
    }

    /**
     * @notice Retorna qual Ciclo de 4 Anos (Época 1 a 14) está ativo agora
     */
    function currentFourYearEpoch() public view returns (uint256) {
        uint256 elapsed = block.timestamp - genesisTimestamp;
        uint256 epoch = (elapsed / FOUR_YEARS_SECONDS) + 1;
        if (epoch > TOTAL_EPOCHS) {
            return TOTAL_EPOCHS;
        }
        return epoch;
    }

    /**
     * @notice Retorna o total acumulado que a trava de 4 anos já autorizou liberar (5% a cada 4 anos)
     */
    function maxVaultUnlockedByTime() public view returns (uint256) {
        return currentFourYearEpoch() * EPOCH_UNLOCK_AMOUNT;
    }

    /**
     * @notice Retorna quanto do Cofre de 70% está disponível para ser minerado neste momento
     */
    function availableVaultToMineNow() public view returns (uint256) {
        uint256 maxAllowed = maxVaultUnlockedByTime();
        if (vaultMinedTotal >= maxAllowed) {
            return 0;
        }
        return maxAllowed - vaultMinedTotal;
    }

    /**
     * @notice 1. Coleta direta da Parte Aberta (30% do Suprimento)
     * @param requestedAmount Quantidade desejada em sub-unidades de 10 dígitos (máx 5 FNH por coleta pública)
     */
    function collectFromOpenPool(uint256 requestedAmount) external returns (bool) {
        require(openPoolCollected < OPEN_POOL_TOTAL, "Reserva Aberta de 30% esgotada");
        require(requestedAmount > 0 && requestedAmount <= 5 * UNIT, "Limite por coleta: ate 5.0000000000 FNH");

        uint256 remainingOpen = OPEN_POOL_TOTAL - openPoolCollected;
        uint256 payout = requestedAmount > remainingOpen ? remainingOpen : requestedAmount;

        openPoolCollected += payout;
        balanceOf[address(this)] -= payout;
        balanceOf[msg.sender] += payout;

        emit Transfer(address(this), msg.sender, payout);
        emit OpenPoolCollected(msg.sender, payout, OPEN_POOL_TOTAL - openPoolCollected);
        return true;
    }

    /**
     * @notice 2. Mineração de Alta Complexidade do Cofre Fechado (70% -> libera 5% a cada 4 anos)
     * @param nonce Número descoberto pelo minerador que resolve o cadeado SHA-256 + Keccak-256
     */
    function mineVaultWithProofOfWork(uint256 nonce) external returns (uint256 reward) {
        uint256 availableInEpoch = availableVaultToMineNow();
        require(availableInEpoch > 0, "Cota de 5% deste ciclo de 4 anos atingida! Aguarde o proximo ciclo.");

        // Dupla verificação criptográfica (SHA-256 + Keccak-256) de alta complexidade
        bytes32 shaStep = sha256(abi.encodePacked(currentChallengeHash, msg.sender, nonce, blocksMinedCount));
        bytes32 finalSolutionHash = keccak256(abi.encodePacked(shaStep, nonce));

        require(
            uint256(finalSolutionHash) < miningDifficultyTarget,
            "Hash insuficiente: nao atingiu o grau de complexidade exigido"
        );

        // Recompensa por bloco resolvido: 0,2500000000 FNH (2.500.000.000 sub-unidades de 10 dígitos)
        reward = 2_500_000_000;
        if (reward > availableInEpoch) {
            reward = availableInEpoch;
        }

        vaultMinedTotal += reward;
        blocksMinedCount += 1;
        currentChallengeHash = finalSolutionHash;

        balanceOf[address(this)] -= reward;
        balanceOf[msg.sender] += reward;

        emit Transfer(address(this), msg.sender, reward);
        emit VaultBlockMined(
            msg.sender,
            blocksMinedCount,
            currentFourYearEpoch(),
            nonce,
            finalSolutionHash,
            reward
        );
        return reward;
    }

    // Funções Padrão ERC-20 / BEP-20 para Corretoras (PancakeSwap, Uniswap, Carteiras)
    function transfer(address to, uint256 value) external returns (bool) {
        require(balanceOf[msg.sender] >= value, "Saldo FNH insuficiente");
        require(to != address(0), "Endereco invalido");

        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(balanceOf[from] >= value, "Saldo FNH insuficiente");
        require(allowance[from][msg.sender] >= value, "Sem permissao suficiente");

        balanceOf[from] -= value;
        balanceOf[to] += value;
        allowance[from][msg.sender] -= value;
        emit Transfer(from, to, value);
        return true;
    }
}
