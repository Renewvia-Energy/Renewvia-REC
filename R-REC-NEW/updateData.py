#!/usr/bin/python3
# update contracts json data with information from api

import requests
import json
import os

# keys to use in the Api call
API_KEY = "FV7VI88AT9SBQDZU3WYWGPWZNVDUEY9RTW"
WALLET_ADDR = "0x9Db94E89DB9798544494a71C01E3552D6adE79bE"

# get keys from environment variables
# set environment variable  < export API_KEY="your key">
# API_KEY = os.environ.get('API_KEY')
# WALLET_ADDR = os.environ.get("WALLET_ADDR")

# pass keys as arguments when running the script  => ./updateData <your API_KEY> <your WALLET_address>
# API_KEY = os.sys.argv[1]
# WALLET_ADDR = os.sys.argv[2]

# url to get all contracts from github
contractsUrl = 'https://raw.githubusercontent.com/Faith-Kimongo/Renewvia-REC/main/R-REC-NEW/contracts.json'

print('Getting data from github ...')

# use requests module to send get request and get json data from github contracts.json file
response = requests.get(contractsUrl)
allContracts = response.json()

# transaction url for api
TRANSACTION_URL = f"https://api.bscscan.com/api?module=account&action=tokentx&address={WALLET_ADDR}&page=1&offset=0&startblock=0&endblock=999999999&sort=asc&apikey={API_KEY}"
# TRANSACTION_URL = "https://bscscan.com/address/0x9Db94E89DB9798544494a71C01E3552D6adE79bE"

print('Retrieving Transactions from API ...')
response = requests.get(TRANSACTION_URL)
allTransactions = response.json()['result']

print('Sorting transactions per contact ...')
for transaction in allTransactions:
    for contract in allContracts:
        #check if the transaction.contractAddress matches contract.address, add to contract.transaction[]
        if transaction['contractAddress'] == contract['address']:
            contract['transactions'].append(transaction)
            break

print('Setting the QTY value ...')
for contract in allContracts:
    QTY_URL = f"https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress={contract['address']}&address={WALLET_ADDR}&tag=latest&apikey={API_KEY}"

    response = requests.get(QTY_URL)
    data = response.json()
    api_qty = data['result']
    if api_qty == "0":
        qty = 0
    else:
        qty = data['result'].strip("0")
        qty = int(qty)
    contract['qty'] = qty

allContracts = json.dumps(allContracts)

print('Updating contracts.json file ...')

# write new contracts with updated value to contracts.json file
with open('contracts.json', 'w') as file:
    file.write(allContracts)

print('contracts.json file updated')

print('Pushing the contract.json file to github ...')
# push contracts.json to git
os.system("git add contracts.json")
os.system("git commit -m 'updated contracts.json'")
os.system("git push")
# print ('Done')