const contractAddress = "0x54675D99576212c7eC1F5F239c6DA3D2A2d11293"; 

const abi = [
	{
		"inputs": [],
		"name": "depositFunds",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [],
		"stateMutability": "payable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "depositor",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "FundsDeposited",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "FundsWithdrawn",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "player",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "enum RockPaperScissors.Choice",
				"name": "playerChoice",
				"type": "uint8"
			},
			{
				"indexed": false,
				"internalType": "enum RockPaperScissors.Choice",
				"name": "contractChoice",
				"type": "uint8"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "betAmount",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "payout",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "won",
				"type": "bool"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "draw",
				"type": "bool"
			}
		],
		"name": "GamePlayed",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "enum RockPaperScissors.Choice",
				"name": "_playerChoice",
				"type": "uint8"
			}
		],
		"name": "play",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_newOwner",
				"type": "address"
			}
		],
		"name": "transferOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_amount",
				"type": "uint256"
			}
		],
		"name": "withdrawFunds",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"stateMutability": "payable",
		"type": "receive"
	},
	{
		"inputs": [],
		"name": "getContractBalance",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "MIN_BET",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

let provider;
let signer;
let contract;

async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            provider = new ethers.BrowserProvider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            signer = await provider.getSigner();
            const address = await signer.getAddress();
            
            document.getElementById('walletAddress').innerText = 
                `Connected: ${address.slice(0,6)}...${address.slice(-4)}`;
            
            const balance = await provider.getBalance(address);
            document.getElementById('balance').innerText = 
                ethers.formatEther(balance);
            
            contract = new ethers.Contract(contractAddress, abi, signer);
            console.log('Contract connected successfully');
            
            loadHistory();
        } catch (error) {
            console.error('Connection error:', error);
            alert("Failed to connect wallet: " + error.message);
        }
    } else {
        alert("Please install MetaMask!");
    }
}

async function play(choice) {
    if (!contract) {
        alert("Please connect wallet first!");
        return;
    }
    
    try {
        console.log('Playing with choice:', choice);
        const tx = await contract.play(choice, {
            value: ethers.parseEther("0.0001"),
            gasLimit: 300000
        });
        
        console.log('Transaction sent:', tx.hash);
        alert("Transaction sent! Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt);
        
        // Получаем результат из события
        const event = receipt.logs.find(log => {
            try {
                return contract.interface.parseLog(log).name === 'GamePlayed';
            } catch {
                return false;
            }
        });
        
        if (event) {
            const parsedEvent = contract.interface.parseLog(event);
            
            // Сохраняем в localStorage
            const gameData = {
                playerChoice: Number(parsedEvent.args.playerChoice),
                contractChoice: Number(parsedEvent.args.contractChoice),
                won: parsedEvent.args.won,
                draw: parsedEvent.args.draw, // Поддержка ничьих
                payout: ethers.formatEther(parsedEvent.args.payout),
                timestamp: Date.now()
            };
            
            saveGameToLocalStorage(gameData);
        }
        
        alert("Game played! Check results in history");
        
        // Обновляем баланс
        const address = await signer.getAddress();
        const balance = await provider.getBalance(address);
        document.getElementById('balance').innerText = ethers.formatEther(balance);
        
        loadHistory();
    } catch (error) {
        console.error('Play error:', error);
        alert("Transaction failed: " + error.message);
    }
}

function saveGameToLocalStorage(gameData) {
    let games = JSON.parse(localStorage.getItem('rps_games') || '[]');
    games.unshift(gameData); // Добавляем в начало
    games = games.slice(0, 20); // Храним последние 20 игр
    localStorage.setItem('rps_games', JSON.stringify(games));
}

function loadHistory() {
    const historyDiv = document.getElementById('history');
    
    if (!contract) {
        historyDiv.innerHTML = '<p>Please connect wallet first</p>';
        return;
    }
    
    // Загружаем из localStorage
    const games = JSON.parse(localStorage.getItem('rps_games') || '[]');
    
    if (games.length === 0) {
        historyDiv.innerHTML = '<p>No games played yet. Play your first game!</p>';
        return;
    }
    
    historyDiv.innerHTML = '';
    
    games.forEach((game) => {
        const choices = ['🪨 Rock', '📄 Paper', '✂️ Scissors'];
        const playerChoice = choices[game.playerChoice];
        const contractChoice = choices[game.contractChoice];
        const won = game.won;
        const draw = game.draw || false; // Поддержка старых данных без draw
        const payout = game.payout;
        
        const item = document.createElement('div');
        
        // Проверка на ничью
        if (draw) {
            item.className = 'history-item draw';
            item.innerHTML = `
                <strong>🤝 DRAW</strong><br>
                You: ${playerChoice} vs Contract: ${contractChoice}<br>
                Bet refunded: ${payout} tBNB
            `;
        } else if (won) {
            item.className = 'history-item win';
            item.innerHTML = `
                <strong>✅ WIN</strong><br>
                You: ${playerChoice} vs Contract: ${contractChoice}<br>
                Payout: ${payout} tBNB
            `;
        } else {
            item.className = 'history-item lose';
            item.innerHTML = `
                <strong>❌ LOSE</strong><br>
                You: ${playerChoice} vs Contract: ${contractChoice}<br>
                Better luck next time!
            `;
        }
        
        historyDiv.appendChild(item);
    });
}