import requests, json, sys
from web3 import Web3
w3 = Web3(Web3.HTTPProvider('https://bsc-dataseed.binance.org/'))

RETURN_WALLET = '0x6E61B86d97EBe007E09770E6C76271645201fd07'
RETIREMENT_WALLET = 'NOT_YET_CREATED'

API_KEY = sys.argv[1]
CONTRACTS_FN = sys.argv[2]
ABI_FN = sys.argv[3]

# Load all R-REC contracts
with open(CONTRACTS_FN, 'r') as f:
	contracts = json.load(f)

# Load ABI
with open(ABI_FN, 'r') as f:
	abi = json.load(f)

for contract in contracts:
	print(contract['name'])
	w3Contract = w3.eth.contract(address=contract['address'], abi=abi)

	# Get Most Recent Already-Recorded Block
	mostRecentTimeStamp = 0
	if len(contract['transactions']) > 0:
		mostRecentTimeStamp = int(contract['transactions'][-1]['timeStamp'])

	# Get Contract Transactions from API
	response = requests.get('https://api.bscscan.com/api?module=account&action=txlist&address={address}&startblock=0&endblock=99999999&page=1&offset=10&sort=asc&apikey={api_key}'.format(address=contract['address'], api_key=API_KEY))
	if response.status_code == 200:
		blocks = response.json()['result']
		for block in blocks:
			if not block['to']:	# Contract creation block
				continue
			if int(block['timeStamp']) > mostRecentTimeStamp:	# Only add blocks that you don't already have
				decoded_data = w3Contract.decode_function_input(block['input'])
				func = str(decoded_data[0])[10:]
				func = func[:func.find('(')]
				if func == 'mint':
					action = 'mint'
					amount = decoded_data[1]['amount']
				elif func == 'transfer':
					if decoded_data[1]['to'].casefold() == RETURN_WALLET.casefold():
						action = 'return'
					elif decoded_data[1]['to'].casefold() == RETIREMENT_WALLET.casefold():
						action = 'retire'
					else:
						action = 'transfer'
					amount = round(decoded_data[1]['amount']/1e18)
				else:
					raise Exception('Unknown function error: {func} in block {block} on contract {name} at {address}'.format(func=func, block=block['blockNumber'], name=contract['name'], address=contract['address']))
				contract['transactions'].append({
					'timeStamp': block['timeStamp'],
					'action': action,
					'amount': amount,
					'to': decoded_data[1]['to'],
					'from': block['from'],
					'blockNumber': block['blockNumber']
				})
	else:
		raise Exception(f"Error fetching data: {response.status_code}")

with open(CONTRACTS_FN[:CONTRACTS_FN.find('.')]+'_new.json', 'w', encoding='utf-8') as f:
	json.dump(contracts, f, ensure_ascii=False, indent='\t')