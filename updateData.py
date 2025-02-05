import requests, json, argparse, web3.exceptions
from web3 import Web3
w3 = Web3(Web3.HTTPProvider('https://bsc-dataseed.binance.org/'))

RETURN_WALLET = '0x6E61B86d97EBe007E09770E6C76271645201fd07'
RETIREMENT_WALLET = '0x51475BEdAe21624c5AD8F750cDBDc4c15Ca8F93f'
MAX_TRIES = 2

if __name__ == '__main__':
	# Argparse
	parser = argparse.ArgumentParser(prog='Update Data', description='Update contracts.json from blockchain')
	parser.add_argument('api_key', help='Your BSC API key')
	parser.add_argument('contracts_fn', help='Path to contracts.json')
	parser.add_argument('abi_fn', help='Path to abi.json')
	parser.add_argument('-c', '--contract', help='Only update the specified contract')
	args = parser.parse_args()

	# Load all R-REC contracts
	with open(args.contracts_fn, 'r') as f:
		contracts = json.load(f)

	# Load ABI
	with open(args.abi_fn, 'r') as f:
		abi = json.load(f)

	for contract in contracts:
		print(contract['name'])
		if contract['address'] is None:
			print('\tNo address')
		elif 'ignore' in contract and contract['ignore']:
			print('\tIgnoring')
		elif args.contract is not None and args.contract not in contract['name'] and args.contract not in contract['abbreviation']:
			print('\tSkipping')
		else:
			try:
				w3Contract = w3.eth.contract(address=contract['address'], abi=abi)
			except web3.exceptions.InvalidAddress as e:
				if 'web3.py only accepts checksum addresses' in str(e):
					print('The {name} contract has a non-checksum address, {address}. Please replace this using the address from BSCScan: https://bscscan.com/address/{address}'.format(name=contract['name'], address=contract['address']))
				else:
					print(str(e))
				exit(0)
			except Exception as e:
				print(str(e))
				exit(0)

			# Get Most Recent Already-Recorded Block
			mostRecentTimeStamp = 0
			if len(contract['transactions']) > 0:
				mostRecentTimeStamp = int(contract['transactions'][-1]['timeStamp'])

			# Get Contract Transactions from API
			for i in range(MAX_TRIES):
				try:
					response = requests.get('https://api.bscscan.com/api?module=account&action=txlist&address={address}&startblock=0&endblock=99999999&page=1&offset=10&sort=asc&apikey={api_key}'.format(address=contract['address'], api_key=args.api_key))
					break
				except OSError as e:
					print('\t{}. Retrying...'.format(e.strerror))
			if i==MAX_TRIES-1:
				print('Failed to establish network connection')
				exit(0)

			if response.status_code == 200:
				blocks = response.json()['result']
				
				if (blocks == 'Invalid API Key'):
					print('Invalid API Key')
					exit(0)

				for block in blocks:
					if not block['to']:	# Contract creation block
						continue
					if int(block['timeStamp']) > mostRecentTimeStamp:	# Only add blocks that you don't already have
						try:
							decoded_data = w3Contract.decode_function_input(block['input'])
						except ValueError as e:
							print("\tThere's probably an issue with your ABI. Sorry. Here's the error:")
							print(e)
							exit(0)
						except Exception as e:
							print(e)
							exit(0)
						func = str(decoded_data[0])[10:]
						func = func[:func.find('(')]
						if func == 'mint':
							action = 'mint'
							amount = decoded_data[1]['amount']
							verification_data = decoded_data[1]['additionalInfo']
						elif func == 'transfer':
							if decoded_data[1]['to'].casefold() == RETURN_WALLET.casefold():
								action = 'return'
							elif decoded_data[1]['to'].casefold() == RETIREMENT_WALLET.casefold():
								action = 'retire'
							else:
								action = 'transfer'
							try:
								amount = round(decoded_data[1]['amount']/1e18)
							except Exception as e:
								print(decoded_data)
								print(str(e))
								exit(0)
						else:
							raise Exception('Unknown function error: {func} in block {block} on contract {name} at {address}'.format(func=func, block=block['blockNumber'], name=contract['name'], address=contract['address']))
						contract['transactions'].append({
							'timeStamp': block['timeStamp'],
							'action': action,
							'amount': amount,
							'verification_data': verification_data if action == 'mint' else None,
							'to': decoded_data[1]['to'],
							'from': block['from'],
							'blockNumber': block['blockNumber'],
							'hash': block['hash']
						})
						print('\tAdded transaction {}'.format(block['hash']))
			else:
				raise Exception(f"Error fetching data: {response.status_code}")

	with open(args.contracts_fn[:args.contracts_fn.find('.')]+'_new.json', 'w', encoding='utf-8') as f:
		json.dump(contracts, f, ensure_ascii=False, indent='\t')