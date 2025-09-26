import { ed25519 } from "@noble/curves/ed25519";
import cbor from "cbor";
import jsonld from "jsonld";
import { blake2b } from "@noble/hashes/blake2b";
import { bytesToHex } from "@noble/hashes/utils";
import { Buffer } from "buffer";

export interface CIP100Witness {
  witnessAlgorithm?: string;
  publicKey?: string;
  signature?: string;
}

export interface CIP100Author {
  name?: string;
  witness?: CIP100Witness;
}

export interface CIP100MetadataBody {
  [key: string]: unknown;
}

export interface CIP100Metadata {
  "@context"?: unknown;
  authors?: CIP100Author[];
  body?: CIP100MetadataBody;
  [key: string]: unknown;
}

export interface AuthorVerificationResult {
  name: string;
  publicKey: string | null;
  witnessAlgorithm: string | null;
  signature: string | null;
  valid: boolean;
  error: string | null;
}

export interface CIP100VerificationResult {
  workMode: "verify-cip100";
  result: boolean;
  errorMsg: string;
  authors: AuthorVerificationResult[];
  canonizedHash: string | null;
  body: CIP100MetadataBody | null;
}

export async function canonizeGovernanceData(
  metadata: Required<Pick<CIP100Metadata, "@context" | "body">>
): Promise<{ canonized: string; hash: string }> {
  try {
    const jsonldData = {
      body: metadata.body,
      "@context": metadata["@context"],
    };

    const canonized = (await jsonld.canonize(jsonldData, {
      safe: true,
      algorithm: "URDNA2015",
      format: "application/n-quads",
    })) as string;

    const canonizedBytes = new TextEncoder().encode(canonized);
    const hash = bytesToHex(blake2b(canonizedBytes, { dkLen: 32 }));

    return { canonized, hash };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown canonization error";
    throw new Error(`Canonization failed: ${message}`);
  }
}

function verifyEd25519Signature(
  publicKeyHex: string,
  signatureHex: string,
  messageHex: string
): boolean {
  try {
    const publicKey = Buffer.from(publicKeyHex, "hex");
    const signature = Buffer.from(signatureHex, "hex");
    const message = Buffer.from(messageHex, "hex");

    if (publicKey.length !== 32) {
      return false;
    }
    if (signature.length !== 64) {
      return false;
    }

    return ed25519.verify(signature, message, publicKey);
  } catch (error) {
    console.error("Ed25519 verification error:", error);
    return false;
  }
}

function verifyCOSESignature(
  coseSign1Hex: string,
  coseKeyHex: string,
  dataHex: string
): boolean {
  try {
    const coseKeyStructure = cbor.decode(Buffer.from(coseKeyHex, "hex"));

    if (!(coseKeyStructure instanceof Map) || coseKeyStructure.size < 4) {
      throw new Error(
        "COSE_Key is not valid. It must be a map with at least 4 entries"
      );
    }
    if (coseKeyStructure.get(1) !== 1) {
      throw new Error("COSE_Key map key '1' (kty) is not '1' (OKP)");
    }
    if (coseKeyStructure.get(3) !== -8) {
      throw new Error("COSE_Key map key '3' (alg) is not '-8' (EdDSA)");
    }
    if (coseKeyStructure.get(-1) !== 6) {
      throw new Error("COSE_Key map key '-1' (crv) is not '6' (Ed25519)");
    }
    if (!coseKeyStructure.has(-2)) {
      throw new Error("COSE_Key map key '-2' (public key) is missing");
    }

    const pubKeyBuffer = coseKeyStructure.get(-2);
    if (!Buffer.isBuffer(pubKeyBuffer)) {
      throw new Error("PublicKey entry in the COSE_Key is not a bytearray");
    }
    const pubKey = pubKeyBuffer.toString("hex");

    const coseSign1Structure = cbor.decode(Buffer.from(coseSign1Hex, "hex"));

    if (!Array.isArray(coseSign1Structure) || coseSign1Structure.length !== 4) {
      throw new Error(
        "COSE_Sign1 is not a valid signature. It must be an array with 4 entries"
      );
    }

    const protectedHeaderBuffer = coseSign1Structure[0];
    if (!Buffer.isBuffer(protectedHeaderBuffer)) {
      throw new Error("Protected header is not a bytearray (serialized) cbor");
    }

    const protectedHeader = cbor.decode(protectedHeaderBuffer);
    if (!(protectedHeader instanceof Map) || !protectedHeader.has(1)) {
      throw new Error("Protected header map key '1' is missing");
    }
    if (protectedHeader.get(1) !== -8) {
      throw new Error("Protected header map key '1' (alg) is not '-8' (EdDSA)");
    }

    const signatureBuffer = coseSign1Structure[3];
    if (!Buffer.isBuffer(signatureBuffer)) {
      throw new Error("Signature is not a bytearray");
    }
    const signatureHex = signatureBuffer.toString("hex");

    const protectedHeaderHex = protectedHeaderBuffer.toString("hex");
    const sigStructure = [
      "Signature1",
      Buffer.from(protectedHeaderHex, "hex"),
      Buffer.from(""),
      Buffer.from(dataHex, "hex"),
    ];

    const sigStructureHex = cbor.encode(sigStructure).toString("hex");

    return verifyEd25519Signature(pubKey, signatureHex, sigStructureHex);
  } catch (error) {
    console.error("COSE signature verification error:", error);
    return false;
  }
}

function verifyAuthorSignature(
  author: CIP100Author,
  canonizedHash: string
): AuthorVerificationResult {
  const result: AuthorVerificationResult = {
    name: author.name ?? "Unknown",
    publicKey: null,
    witnessAlgorithm: null,
    signature: null,
    valid: false,
    error: null,
  };

  try {
    if (!author.witness) {
      throw new Error("Missing witness object");
    }
    const { witness } = author;

    if (!witness.witnessAlgorithm) {
      throw new Error("Missing witnessAlgorithm in witness");
    }
    if (!witness.publicKey) {
      throw new Error("Missing publicKey in witness");
    }
    if (!witness.signature) {
      throw new Error("Missing signature in witness");
    }

    result.witnessAlgorithm = witness.witnessAlgorithm;
    result.publicKey = witness.publicKey;
    result.signature = witness.signature;

    switch (witness.witnessAlgorithm) {
      case "ed25519":
        result.valid = verifyEd25519Signature(
          witness.publicKey,
          witness.signature,
          canonizedHash
        );
        break;
      case "CIP-0008":
      case "CIP-0030": {
        const coseKeyHex = `a4010103272006215820${witness.publicKey}`;
        result.valid = verifyCOSESignature(
          witness.signature,
          coseKeyHex,
          canonizedHash
        );
        break;
      }
      default:
        throw new Error(`Unsupported witnessAlgorithm: ${witness.witnessAlgorithm}`);
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.valid = false;
  }

  return result;
}

export async function verifyCIP100Metadata(
  metadata: CIP100Metadata | string
): Promise<CIP100VerificationResult> {
  const result: CIP100VerificationResult = {
    workMode: "verify-cip100",
    result: false,
    errorMsg: "",
    authors: [],
    canonizedHash: null,
    body: null,
  };

  try {
    const parsedMetadata: CIP100Metadata =
      typeof metadata === "string" ? JSON.parse(metadata) : metadata;

    if (!parsedMetadata["@context"]) {
      throw new Error("Missing @context field in metadata");
    }

    if (!Array.isArray(parsedMetadata.authors)) {
      throw new Error("Authors field must be an array");
    }

    if (parsedMetadata.authors.length === 0) {
      throw new Error(
        "This metadata has no author, so we cannot check if it is authentic"
      );
    }

    if (!parsedMetadata.body) {
      throw new Error("Missing body field in metadata");
    }

    result.body = parsedMetadata.body;

    const { hash } = await canonizeGovernanceData({
      "@context": parsedMetadata["@context"],
      body: parsedMetadata.body,
    });
    result.canonizedHash = hash;

    let allAuthorsValid = true;
    const authorResults = parsedMetadata.authors.map((author) => {
      const authorResult = verifyAuthorSignature(author, hash);
      if (!authorResult.valid) {
        allAuthorsValid = false;
        if (authorResult.error) {
          result.errorMsg += `Author '${authorResult.name}': ${authorResult.error}. `;
        }
      }
      return authorResult;
    });

    result.authors = authorResults;
    result.result = allAuthorsValid && authorResults.length > 0;

    if (result.result) {
      result.errorMsg = "";
    } else if (!result.errorMsg) {
      result.errorMsg = "Author signature verification failed";
    }
  } catch (error) {
    result.result = false;
    result.errorMsg = error instanceof Error ? error.message : String(error);
  }

  return result;
}
