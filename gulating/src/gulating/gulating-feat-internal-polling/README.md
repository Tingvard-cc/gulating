# Gulating 🏛️

A governance voting tool for **Tingvard**. This application enables our members to securely vote on governance actions by connecting their Cardano wallet.

This project is a fork of the [Intersect Council Toolkit App](https://github.com/IntersectMBO/council-toolkit-app), adapted for the specific needs of Tingvard.

-----

## Features

✨ **Secure Wallet Connection:** Connect your preferred Cardano wallet to interact with the application.

✅ **Transaction Validation:** Pre-validates unsigned governance transactions to ensure they meet the required criteria before you sign.

✍️ **Effortless Signing:** Seamlessly pass validated transactions to your wallet for a final review and signature.

🌐 **Network Support:** Fully functional on both Cardano **Mainnet** and the **Pre-production** testnet.

-----

## How It Works

Follow these steps to cast your vote on a governance action:

1.  **Connect Wallet**: Launch the Gulating app and connect your wallet.
2.  **Select Network**: Ensure your wallet is set to the correct network (**Mainnet** for official votes or **Pre-prod** for testing).
3.  **Provide Transaction**: Paste the raw, unsigned transaction data into the designated input field.
4.  **Check Transaction**: Click the "Check Transaction" button. The application will perform a series of validity checks.
5.  **Sign Transaction**: If the transaction is valid, you will be prompted to pass it to your connected wallet to review and sign, which produces the required signature.

-----

## Architecture

The application's architecture is designed for security and simplicity. It acts as a trusted interface between your wallet and the unsigned transaction data. It never has access to your private keys and relies entirely on the connected wallet for all cryptographic operations.

-----

## Contributing

Contributions from the community are welcome\! If you'd like to contribute, please feel free to open an issue to discuss a new feature or submit a pull request.

-----

## License

This project is licensed under the Apache 2.0 License - see the `LICENSE` file for details.

-----

## Acknowledgements

A special thank you to the team at **Intersect** for developing and open-sourcing the original [Council Toolkit App](https://github.com/IntersectMBO/council-toolkit-app) upon which Gulating is based.
