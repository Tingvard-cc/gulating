# Gulating

Gulating is a web-based voting platform for Tingvard, inspired by the democratic processes of ancient Norse assemblies. It helps communities discover live governance proposals, coordinate internal polls, and collect signed witness files for on-chain governance actions.

---

## What it does

* Discover live Cardano governance proposals
* Run internal polls
* Collect and serve witness signatures
* Wallet-ready front end

---

## Tech stack

* Next.js (App Router API routes)
* MUI (Material UI)
* @meshsdk/core / @meshsdk/react
* Koios API
* File-backed storage (data/votes.json and storage/signatures/...)

---

## Project layout (high level)

* next.config.mjs – Next.js config
* page.tsx – Main UI
* route.ts – API route (/api/gov-actions)
* components/ – Wallet, Transaction, InternalVote, Rationale, LiveActions

---

## API

All endpoints live under /api/gov-actions.

GET /api/gov-actions

* Download a stored witness file (params: download=1, govActionID, filename)
* Fetch internal votes for a proposal (param: proposalId)
* List active governance proposals from Koios

POST /api/gov-actions

* Store a witness signature
* Save internal votes

Notes:

* govActionID must match between envelope and payload.
* Files are saved under storage/signatures/<safeGovActionID>/<filename>, with a timestamp suffix if the name already exists.

Save internal votes body (JSON):
{
"proposalId": "…",
"votes": {
"memberKeyHash1": "yes",
"memberKeyHash2": "abstain"
}
}

Persists to data/votes.json (created on demand).

---

## Getting started

Prerequisites:

* Node.js 18+ (20+ recommended)
* pnpm or npm

Install & run (development):
pnpm install   # or npm install
pnpm next dev  # or npx next dev

Build & run (production):
pnpm next build  # or npx next build
pnpm next start  # or npx next start

---

## Configuration

Environment variables (optional):

* KOIOS\_API\_URL — defaults to [https://api.koios.rest/api/v1](https://api.koios.rest/api/v1)
* KOIOS\_API\_TOKEN — Bearer token for Koios
* SIGNATURES\_DIR — default ./storage/signatures

Filesystem paths:

* Votes file: ./data/votes.json
* Signatures: ./storage/signatures/<govActionID>/<filename>

---

## Security & deployment notes

* Witness files are saved as submitted.
* Restrict POST to /api/gov-actions if needed.
* Ensure runtime supports Node.js and can write to storage.
* Consider moving votes/signatures to database or object storage.

---

## UI overview

Main page (page.tsx) renders:

* Wallet connect (Mesh SDK)
* Tabs for live actions, rationale, internal voting
* Responsive MUI layout
* Loading skeletons

---

## Local testing tips

* GET /api/gov-actions to verify Koios connectivity.
* POST witness JSON and test download.
* POST votes and check data/votes.json updates.

---

## Acknowledgements

* Forked from IntersectMBO/council-toolkit-app
* Koios for governance APIs
* Mesh SDK for Cardano wallet tooling
* MUI for UI components

---

## License

Apache License 2.0
[http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Distributed on an "AS IS" basis, without warranties or conditions of any kind.
See the License for the specific language governing permissions and limitations under the License.
