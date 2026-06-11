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
		cmd="forge clean; forge script script/Mint.s.sol --rpc-url polygon -vvvv"
		
		# Add broadcast flag if specified
		if [ -n "$broadcast_flag" ]; then
			cmd="$cmd $broadcast_flag"
		fi
		
		eval $cmd
		;;
	*)
		echo "Error: Invalid argument '$action'"
		echo "Usage: bash rrec.sh [deploy|mint] [--broadcast]"
		exit 1
		;;
esac