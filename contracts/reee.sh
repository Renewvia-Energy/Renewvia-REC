#!/bin/bash

# Check if an argument was provided
if [ $# -eq 0 ]; then
	echo "Error: No argument provided."
	echo "Usage: bash reee.sh [deploy|mint] [--broadcast]"
	exit 1
fi

# Store the first argument
action=$1

# Check for broadcast flag
broadcast_flag=""
if [ $# -gt 1 ] && [ "$2" == "--broadcast" ]; then
	# Load OWNER from .env file
	if [ -f .env ]; then
		source .env
		if [ -z "$OWNER" ]; then
			echo "Error: OWNER environment variable not found in .env file."
			exit 1
		fi
		broadcast_flag="--broadcast --sender $OWNER --verify --verifier etherscan"
	else
		echo "Error: .env file not found."
		exit 1
	fi
fi

# Execute different commands based on the argument
case $action in
	deploy)
		forge clean

		if [ -n "$broadcast_flag" ]; then
			tmp_output=$(mktemp)
			# script creates a pseudo-TTY so vm.prompt works, -e passes through the child exit code
			script -q -e -c "forge script script/DeployNewContract.s.sol --rpc-url polygon $broadcast_flag" "$tmp_output"
			forge_exit=$?

			if [ $forge_exit -ne 0 ]; then
				mapfile -t guids < <(grep 'GUID:' "$tmp_output" | sed 's/\x1b\[[0-9;]*m//g; s/\r//g' | sed "s/.*GUID: \`\(.*\)\`.*/\1/")

				if [ ${#guids[@]} -gt 0 ]; then
					echo ""
					echo "Verification timed out. ${#guids[@]} contract(s) still pending on Polygonscan."

					while true; do
						echo ""
						read -p "Press Enter to query Polygonscan, or type 'q' to quit: " response
						[ "$response" = "q" ] && break

						pending=0
						for guid in "${guids[@]}"; do
							echo "Checking $guid..."
							if ! forge verify-check "$guid" --chain polygon --verifier etherscan; then
								((pending++))
							fi
						done

						if [ $pending -eq 0 ]; then
							echo "All contracts verified!"
							break
						fi
						echo "$pending contract(s) still pending."
					done
				fi
			fi

			rm -f "$tmp_output"
		else
			forge script script/DeployNewContract.s.sol --rpc-url polygon
		fi
		;;
	mint)
		cmd="forge clean; forge script script/Mint.s.sol --rpc-url polygon"

		# Add broadcast flag if specified
		if [ -n "$broadcast_flag" ]; then
			cmd="$cmd $broadcast_flag"
		fi

		# Snapshot totalSupply before broadcast so we can detect when the chain updates
		pre_supply=""
		if [ -n "$broadcast_flag" ]; then
			pre_supply=$(cast call "$MINT_PROXY" "totalSupply()(uint256)" --rpc-url polygon 2>/dev/null)
		fi

		eval $cmd
		mint_exit=$?

		# After a broadcast mint, refresh the web frontend's contracts.json from chain
		if [ -n "$broadcast_flag" ] && [ $mint_exit -eq 0 ]; then
			# Poll the chain until totalSupply reflects the mint (up to 5 minutes)
			if [ -n "$pre_supply" ]; then
				echo ""
				echo "Waiting for on-chain confirmation..."
				confirmed=0
				for i in $(seq 1 60); do
					sleep 5
					post_supply=$(cast call "$MINT_PROXY" "totalSupply()(uint256)" --rpc-url polygon 2>/dev/null)
					if [ -n "$post_supply" ] && [ "$post_supply" != "$pre_supply" ]; then
						echo "Confirmed: totalSupply $pre_supply → $post_supply"
						confirmed=1
						break
					fi
					echo "  Still waiting... ($((i * 5))s elapsed)"
				done
				[ $confirmed -eq 0 ] && echo "Warning: timed out waiting for on-chain confirmation after 5 minutes."
			fi

			# Resolve the minted proxy address to a contract abbreviation for updateData.py's -c filter
			contract_id=$(cd .. && python3 -c "
import json, sys
addr = sys.argv[1].lower()
for c in json.load(open('web/js/contracts.json')):
	if (c.get('address') or '').lower() == addr:
		print(c['abbreviation'])
		break
" "$MINT_PROXY")

			echo ""
			if [ -n "$contract_id" ]; then
				echo "Updating contracts.json for $contract_id ($MINT_PROXY)..."
				(cd .. && python3 scripts/updateData.py -i -c "$contract_id")
			else
				echo "Warning: $MINT_PROXY not found in web/js/contracts.json; updating all contracts."
				(cd .. && python3 scripts/updateData.py -i)
			fi
		fi
		;;
	*)
		echo "Error: Invalid argument '$action'"
		echo "Usage: bash rrec.sh [deploy|mint] [--broadcast]"
		exit 1
		;;
esac