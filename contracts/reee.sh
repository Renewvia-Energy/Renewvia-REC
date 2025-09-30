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
		cmd="forge clean; forge script script/DeployNewContract.s.sol --rpc-url polygon -vvvv"
		
		# Add broadcast flag if specified
		if [ -n "$broadcast_flag" ]; then
			cmd="$cmd $broadcast_flag"
		fi
		
		eval $cmd
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