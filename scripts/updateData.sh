#!/bin/bash

# sudo apt install python3-full python3-venv
# python3 -m venv myenv

source ../contracts/.env
# source myenv/bin/activate
python3 updateData.py "$ETHERSCAN_API_KEY" ../web/js/contracts.json ../web/js/abi.json
# deactivate