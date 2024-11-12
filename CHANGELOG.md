## [2.3.2](https://github.com/ar-io/ar-io-sdk/compare/v2.3.1...v2.3.2) (2024-10-16)


### Bug Fixes

* **io:** add `getDemandFactor` api ([feab461](https://github.com/ar-io/ar-io-sdk/commit/feab4612d4e95b0fea14a4e0fa9f17a5c57779e1))
* **io:** update `getTokenSupply` to type that returns full breakdown of tokens ([e790055](https://github.com/ar-io/ar-io-sdk/commit/e790055d03df0786c93db54d4d3294160fac1ad5))
* **types:** add `totalEligibleGateways` to `AoEpochDistributionData` type ([9a35d39](https://github.com/ar-io/ar-io-sdk/commit/9a35d39ed811076a03a392cd5ac7b8f2ce878d98))
* **types:** update gateways to include services ([a3fe5b4](https://github.com/ar-io/ar-io-sdk/commit/a3fe5b41725d1648f19d8e72d71e59d41bed91fe))

## [2.3.1](https://github.com/ar-io/ar-io-sdk/compare/v2.3.0...v2.3.1) (2024-10-09)


### Bug Fixes

* use AoEpochObservationData type to match what is coming back from contract ([684abf3](https://github.com/ar-io/ar-io-sdk/commit/684abf34607e62e3b9e8bb92fa4da6e202b84061))

# [2.3.0](https://github.com/ar-io/ar-io-sdk/compare/v2.2.5...v2.3.0) (2024-10-08)


### Bug Fixes

* **ao:** check messages is not empty to avoid `.length` error when evaluating outputs of `dryrun` ([a7b4953](https://github.com/ar-io/ar-io-sdk/commit/a7b495334f5d3962807de9f630518a270a6e35a6))
* **logs:** enable logging in spawn and evolve utils ([08ce71a](https://github.com/ar-io/ar-io-sdk/commit/08ce71a2cfed30b09138194d8841ff1b1adccde4))
* **luaID:** update lua id to latest for ant source code ([9c13dd3](https://github.com/ar-io/ar-io-sdk/commit/9c13dd37b5feec69cd0a5f7dba64f85b5285888b))
* **main:** merge main back to alpha, release hotfixes on alpha ([9299427](https://github.com/ar-io/ar-io-sdk/commit/929942755b09204e4d142e673b82f6400b8fe596))
* **types:** add source code tx id to ant state type ([8949f04](https://github.com/ar-io/ar-io-sdk/commit/8949f04889741cc2c895bacea4ef3831c9c2ac15))
* **types:** fix types on ant ([3bdb3a6](https://github.com/ar-io/ar-io-sdk/commit/3bdb3a6e8c30fc55780b716ea9a05619b19bfcee))
* **types:** remove restricted type ([b1fac75](https://github.com/ar-io/ar-io-sdk/commit/b1fac7505484bf62fde044ca0c6c9895b3678859))
* **types:** update type and tests ([877b03f](https://github.com/ar-io/ar-io-sdk/commit/877b03f4124894cafbd0bc60b9d55b8803365cec))
* **types:** update types ([883ffb3](https://github.com/ar-io/ar-io-sdk/commit/883ffb35549d8fe40963489d93a6423f534d29e8))


### Features

* **delegates:** add cancel delegate withdrawal method ([a3827dc](https://github.com/ar-io/ar-io-sdk/commit/a3827dcd83f35e9fc9fbde26e6dbb38f88ab9f36))
* **io:** add api for querying get registration fees handler to AoIORead class ([7b3909f](https://github.com/ar-io/ar-io-sdk/commit/7b3909fb9def0e864dc59d87d1d78c9718feb830))

## [2.2.5](https://github.com/ar-io/ar-io-sdk/compare/v2.2.4...v2.2.5) (2024-09-26)


### Bug Fixes

* **ant:** allow sending tags on ant write interactions ([99c24f8](https://github.com/ar-io/ar-io-sdk/commit/99c24f85e7e5829fb009f23702fa25243cf603da))

## [2.2.4](https://github.com/ar-io/ar-io-sdk/compare/v2.2.3...v2.2.4) (2024-09-26)


### Bug Fixes

* **types:** update getInfo types on IO ([7a0d20d](https://github.com/ar-io/ar-io-sdk/commit/7a0d20da45373ef370617db9dc07e7bf54feab4f))

## [2.2.3](https://github.com/ar-io/ar-io-sdk/compare/v2.2.2...v2.2.3) (2024-09-25)

### Bug Fixes

* **types:** update type and tests ([877b03f](https://github.com/ar-io/ar-io-sdk/commit/877b03f4124894cafbd0bc60b9d55b8803365cec))


## [2.2.2](https://github.com/ar-io/ar-io-sdk/compare/v2.2.1...v2.2.2) (2024-09-23)


### Bug Fixes

* **deps:** update arbundles to @dha-team/arbundles ([c41e4e4](https://github.com/ar-io/ar-io-sdk/commit/c41e4e42057698a9a2895c2ac9e78a01c69bc2d5))

## [2.2.1](https://github.com/ar-io/ar-io-sdk/compare/v2.2.0...v2.2.1) (2024-09-16)


### Bug Fixes

* **types:** correct totalEpochCount for gateway stats ([f82fed8](https://github.com/ar-io/ar-io-sdk/commit/f82fed8bc54b8d3f1a17ff78a72712709858952e))

# [2.2.0](https://github.com/ar-io/ar-io-sdk/compare/v2.1.0...v2.2.0) (2024-08-30)


### Bug Fixes

* **logger:** permit logger as argument for typeguard util and default it ([45df626](https://github.com/ar-io/ar-io-sdk/commit/45df6267df3260744201aa86ced572e5da842aae))
* **register:** update spawn ant to register at end of spawn ([4320c80](https://github.com/ar-io/ar-io-sdk/commit/4320c803bec96eedf4fe4bd5456a5eaa4ac9ae88))
* **signer:** add typeguard util for aoSigner ([0d7f210](https://github.com/ar-io/ar-io-sdk/commit/0d7f210ac3ab44a1c7ea296936917e5297878e48))
* **signing:** add aosigner to contract signer ([3b0495a](https://github.com/ar-io/ar-io-sdk/commit/3b0495a3ca4420c61cf4f72c7eb451777cbaf16d))
* **tests:** dont send messages to ao in e2e tests ([e7108da](https://github.com/ar-io/ar-io-sdk/commit/e7108dafb7602e29833b0120c91cff73b022d31f))
* **tests:** reconfigure test structure ([1872a26](https://github.com/ar-io/ar-io-sdk/commit/1872a262b654d72c779c2607ed454c5ae8271e87))
* **tests:** use test-wallet fixture in tests instead of generating anew each time ([27a5dc2](https://github.com/ar-io/ar-io-sdk/commit/27a5dc25cd6bbe75736187280d3f511235dfa0b0))
* **typeguard:** return true or false in typeguard and log the error ([4b851c5](https://github.com/ar-io/ar-io-sdk/commit/4b851c5bd904f66bd88efc67cdc239a1300c7ecf))
* **types:** update types for epoch distributions ([5aedf50](https://github.com/ar-io/ar-io-sdk/commit/5aedf5077a68faec8d86281a401ab2f4d6daf142))
* **util:** use ANTRegistry class for registering ant on spawn instead of aoconnect ([350112d](https://github.com/ar-io/ar-io-sdk/commit/350112d7fb29c180231b69ede5c4c2f94a60afa3))


### Features

* **ant id:** update lua ant id to latest ([968c30e](https://github.com/ar-io/ar-io-sdk/commit/968c30e9b3851c0eed1bb7e152e78835d558243b))
* **util:** add AoAntState typeguard util ([c6f457f](https://github.com/ar-io/ar-io-sdk/commit/c6f457f88f7b17af615ffacc593cc01b77230257))

# [2.1.0](https://github.com/ar-io/ar-io-sdk/compare/v2.0.2...v2.1.0) (2024-08-07)


### Bug Fixes

* **actions:** ignore engines in action ([7f6f87d](https://github.com/ar-io/ar-io-sdk/commit/7f6f87d442dca7970ee495f2b4286049e63cbcff))
* **ant lua id:** update to version Flwio4Lr08g6s6uim6lEJNnVGD9ylvz0_aafvpiL8FI ([8cbd564](https://github.com/ar-io/ar-io-sdk/commit/8cbd564cffb18055c46cb3212a0657e55f02d781))
* **ant:** remove data from ant object, none of our ant methods require data attributes ([0f267c1](https://github.com/ar-io/ar-io-sdk/commit/0f267c1faab7f7c0e923eb7398e3f471c55c4c1f))
* **ao:** update AoProcess to only support string | undefined ([584aee1](https://github.com/ar-io/ar-io-sdk/commit/584aee12cad2a246108d65c827fbddb0e3cd09f9))
* **arns:** update event emitter to provide more events and logs while loading arns records ([8775896](https://github.com/ar-io/ar-io-sdk/commit/87758966e54b9563e8153feb07bba808a110aa5b))
* **constants:** do not set env var for ant registry ([9e61cc7](https://github.com/ar-io/ar-io-sdk/commit/9e61cc7691882c3203da11c8f21a2135ab2c3371))
* **deps:** move arconnect to dev deps ([34f07d2](https://github.com/ar-io/ar-io-sdk/commit/34f07d25024c080f529218569cba57041e34baa2))
* **emiter:** use a set to filter out duplicate ([7887af9](https://github.com/ar-io/ar-io-sdk/commit/7887af9b9e9a14a3b9002b3560f653d2c59ef9cf))
* **emitter:** add page size param for emitter to increase amount of records per page to 50k ([b6f2157](https://github.com/ar-io/ar-io-sdk/commit/b6f215763b5d7b3e713f0dbb1babca99ddd79dfe))
* **errors:** use any type on error ([f14ed5a](https://github.com/ar-io/ar-io-sdk/commit/f14ed5a1ccf9a1d04208f44e8d37dea2aec5fc23))
* **events:** use arns name space for events ([1d67dfe](https://github.com/ar-io/ar-io-sdk/commit/1d67dfe1f7a4766bbce6cf5a55438f33423f660f))
* **evolve:** call eval twice to ensure evolve txid is set ([a6261e5](https://github.com/ar-io/ar-io-sdk/commit/a6261e566bdf9ba6d18bbc9088487f9b79bbd5aa))
* **evolve:** dont double eval ([a2a9121](https://github.com/ar-io/ar-io-sdk/commit/a2a9121cbdbfe1b16e43602cf83f86793f0e8f48))
* **evolve:** fixed evolve somehow ([b06503b](https://github.com/ar-io/ar-io-sdk/commit/b06503b098fee87ef9e710c2fa4cd585416b21ed))
* **example:** dont spawn in example ([d1d5147](https://github.com/ar-io/ar-io-sdk/commit/d1d514759a1a5af90246b2d51a43ca5ec03e5c16))
* **example:** remove unused arweave instance ([d0035c0](https://github.com/ar-io/ar-io-sdk/commit/d0035c01093e8acd3141a933439184897a74ad4e))
* **format:** fix linting issues in format ([b72dc1f](https://github.com/ar-io/ar-io-sdk/commit/b72dc1f4969763568a8d1fa7e36cfd1afb3a5ccb))
* **gateway stats:** update gateway stat types ([a59b166](https://github.com/ar-io/ar-io-sdk/commit/a59b166fa17735889aaae44e2b91cb5964f85f63))
* **io:** add api that returns the total token supply ([261c85c](https://github.com/ar-io/ar-io-sdk/commit/261c85cf44490acc8bb46bd337693d83ffba7120))
* **io:** no longer add data to save observations ([c017b52](https://github.com/ar-io/ar-io-sdk/commit/c017b52ba940a0738367f28043ff885d45e85951))
* **lint:** fix lint errors and warnings ([e532f4e](https://github.com/ar-io/ar-io-sdk/commit/e532f4e4aa11e926631c0beec0eadba0d25835a4))
* **lua id:** set new lua id in constants ([e4c3aaf](https://github.com/ar-io/ar-io-sdk/commit/e4c3aaf8b65c02294e021c2df8dac9d25ea6ec05))
* **naming:** name AoSigner property aoSigner ([4604524](https://github.com/ar-io/ar-io-sdk/commit/4604524dc56333c3ed1698978b61747920c43848))
* **records:** update arns emitter to use ant registry ([e55a67b](https://github.com/ar-io/ar-io-sdk/commit/e55a67ba022fa4a7bfe5bed00de592e99f8dd822))
* **signer:** describe signing function as signer vs aoSigner in case of signer type changes ([3b23f80](https://github.com/ar-io/ar-io-sdk/commit/3b23f80581ea331b89ac31756421f74799315e2c))
* **signer:** move createAoSigner to be a util ([7f7a0e6](https://github.com/ar-io/ar-io-sdk/commit/7f7a0e6f16b1b8f2e900aca056f6f5aaa98bd4f1))
* **signer:** pass in signing function instead of signer class ([cba16e3](https://github.com/ar-io/ar-io-sdk/commit/cba16e3f72d3adf0b0ecf39dd93236511b77bb7c))
* **signer:** use AoSigner type as return type ([8e95edd](https://github.com/ar-io/ar-io-sdk/commit/8e95eddf5723b0fdbf870688556f76a3e80bb6fa))
* **spawn:** update spawn to use ant registry id in the tags ([28dae7f](https://github.com/ar-io/ar-io-sdk/commit/28dae7fe312a6948ce3a2d9fa2db57271f6c5f85))
* **tests:** check the return of ACL on ant tests more granularly ([350bab1](https://github.com/ar-io/ar-io-sdk/commit/350bab13480598ac1f4b1307e8258df06124d0c6))
* **tests:** update e2e tests to only read from ant registry ([a61e0bf](https://github.com/ar-io/ar-io-sdk/commit/a61e0bf0c8106957c6405d05ed57b38c346ed65d))
* **tests:** update web test to use ANT registry in app ([38ca913](https://github.com/ar-io/ar-io-sdk/commit/38ca913fc9f935663b750e4f68e97879d3b70e5f))
* **tests:** use const for unchanging test vars ([9f965e1](https://github.com/ar-io/ar-io-sdk/commit/9f965e12c39ce9e05f8cc7972ee01eca400646ab))
* **test:** update browser test with data test id and render checks ([93741cb](https://github.com/ar-io/ar-io-sdk/commit/93741cb5133d1ce949caa56675290d65c24626f8))
* **test:** use a known wallet adddress in tests ([9dac280](https://github.com/ar-io/ar-io-sdk/commit/9dac28038e1fd8e669414b8a8368c6819c753239))
* **todo:** remove completed todo comment ([c868522](https://github.com/ar-io/ar-io-sdk/commit/c8685227bfa656cd286d08c8998f73c6812857cf))
* **types:** add gateway weights to AoGateway ([e725198](https://github.com/ar-io/ar-io-sdk/commit/e725198093505d4dabbf2e92bc983bd0b69d1ab3))
* **types:** check info on evolve util first ([a44cca1](https://github.com/ar-io/ar-io-sdk/commit/a44cca17fc8d44661326e39d189b5a9e0e43367d))
* **types:** remove deprecated types ([c674876](https://github.com/ar-io/ar-io-sdk/commit/c674876fbdbe85299e7eff75ba0a89187610d00e))
* **types:** update AoGateway to include weights ([5368668](https://github.com/ar-io/ar-io-sdk/commit/5368668ec6fcd84bf6a723a80b13cad7753a8606))
* **types:** update type name to what contract returns ([99edbad](https://github.com/ar-io/ar-io-sdk/commit/99edbad2fb4553d85c366d6c62466d984b42e7cf))
* use custom event names to avoid overlap ([5b919ac](https://github.com/ar-io/ar-io-sdk/commit/5b919ac483778673527e0535a5aec8b06e6ce68e))
* **utils:** revert new util ([c959c81](https://github.com/ar-io/ar-io-sdk/commit/c959c81bd51fb08999a43243ca40579c979aa971))
* **utils:** update util to use ant registry ([b2223d4](https://github.com/ar-io/ar-io-sdk/commit/b2223d4cab716267ade9159fa5932ecfc47f06b2))


### Features

* **ant registry:** add ant registry class ([2056674](https://github.com/ar-io/ar-io-sdk/commit/20566747247e4006bb932216796bf96d51dc60b9))
* **evolve:** add evolve util ([47bfe20](https://github.com/ar-io/ar-io-sdk/commit/47bfe20a9713bfdd82a7ca03ce8576653af29cf0))
* **signing:** add window arweave wallet to available signing options ([7596aec](https://github.com/ar-io/ar-io-sdk/commit/7596aec43557b2a0aac3844a973b78f4fed33b65))

## [2.0.2](https://github.com/ar-io/ar-io-sdk/compare/v2.0.1...v2.0.2) (2024-07-12)


### Bug Fixes

* **types:** update gateway settings type to only support `observerAddress` ([13e073b](https://github.com/ar-io/ar-io-sdk/commit/13e073ba6d7482028e43d5c8fbab8e769d2c9e01))

## [2.0.1](https://github.com/ar-io/ar-io-sdk/compare/v2.0.0...v2.0.1) (2024-07-11)


### Bug Fixes

* **logger:** fixes the console logger to respect the log level provided by web clients ([99d7993](https://github.com/ar-io/ar-io-sdk/commit/99d79939806ef8f26407aa3237ea8773179b91a6))

# [2.0.0](https://github.com/ar-io/ar-io-sdk/compare/v1.2.2...v2.0.0) (2024-07-11)

### Bug Fixes

* **arweave:** use default arweave in IO ([21d25b9](https://github.com/ar-io/ar-io-sdk/commit/21d25b9e1109bc18ba4e074f314848143ed0828c))
* **deps:** replace bunyan or console depending on the client environment ([9d940aa](https://github.com/ar-io/ar-io-sdk/commit/9d940aac99e94e5086091a2e41ffd73fe2c36715))
* **log:** allow log level configuration for clients  ([9cb0981](https://github.com/ar-io/ar-io-sdk/commit/9cb0981e0f48c80fc000c05aba2c4cb69b5ca43c))
* **log:** replace bunyan with winston to ensure browser compatibility ([80b38e0](https://github.com/ar-io/ar-io-sdk/commit/80b38e08879c83a986542f3fd9c65379680bf9b5))

### Features

* **io:** add paginated gateway support for larger state objects (e.g. balances, records, and gateways) ([b23efa8](https://github.com/ar-io/ar-io-sdk/commit/b23efa8e433451c3ff8361c54f6e35fdd30457a0))
* **util:** add utility for fetching all records ([8df2aac](https://github.com/ar-io/ar-io-sdk/commit/8df2aacf530ff24f15cc14022a81f3168b8baea0))
* **io:** add leaveNetwork API ([54222ce](https://github.com/ar-io/ar-io-sdk/commit/54222ce65b25e203b243df7a7c2317f9dc1fc7b9))


### BREAKING CHANGES

* **deps:** removes all smartweave implementations using warp-sdk. The result is an only AO compatible ANT and IO network contracts. Some utilities are preserved due to their usefulness.
* **imports:** modifies `web` named exports to provide esm and cjs exports instead of minified bundle. The web bundle was causing issues in bundled projects, and polyfills are no longer provided by default. Refer to the [README](./README.md) for specifications on how to use the SDK for a web project.

## [1.2.2](https://github.com/ar-io/ar-io-sdk/compare/v1.2.1...v1.2.2) (2024-07-11)


### Bug Fixes

* **api:** ensure timestamps are always in milliseconds ([93b162f](https://github.com/ar-io/ar-io-sdk/commit/93b162f22f27e6af4252e7551f785fbffc062e87))

## [1.2.1](https://github.com/ar-io/ar-io-sdk/compare/v1.2.0...v1.2.1) (2024-07-04)


### Bug Fixes

* **io:** default the IO process to use testnet ([61bca5c](https://github.com/ar-io/ar-io-sdk/commit/61bca5cb4f2ecc1928ebc8271c9acc9f25ac0412))

# [1.2.0](https://github.com/ar-io/ar-io-sdk/compare/v1.1.1...v1.2.0) (2024-07-03)


### Features

* **ant:** add balance APIs to ant interface ([ec67440](https://github.com/ar-io/ar-io-sdk/commit/ec67440b7189c95ce4c2fcc933ef63ca9c1732b6))
* **ant:** add utility for fetch ant modules owned by wallet ([01f7ec9](https://github.com/ar-io/ar-io-sdk/commit/01f7ec95d4de88b3a098a2ab59fa811c9820b279))
* **ants:** support ANT apis in SDK ([b187aeb](https://github.com/ar-io/ar-io-sdk/commit/b187aebc34fd5afc237d5a68aa091d4fe14d0bce))
* **ao:** add spawn ant util ([d02566e](https://github.com/ar-io/ar-io-sdk/commit/d02566eac7385b5a25fb1851fa4aeb4906616328))
* **ao:** experiment with initial implementation of ao contract ([6118cea](https://github.com/ar-io/ar-io-sdk/commit/6118cea0b1d5aa027f97e81b34849bd56107a396))
* **io:** add getInfo method to io class ([4ef25ec](https://github.com/ar-io/ar-io-sdk/commit/4ef25ec37f60a5155e68047f2cffa2c49ecaa093))
* **io:** implement io/ao classes that integrate with IO/AO process and network protocol ([aab8967](https://github.com/ar-io/ar-io-sdk/commit/aab8967c83e69fafe1258b768b1e33cb3920aeb8))

## [1.1.1](https://github.com/ar-io/ar-io-sdk/compare/v1.1.0...v1.1.1) (2024-06-06)


### Bug Fixes

* **api:** default evaluation options on getArNSReservedNames api ([0a1f22e](https://github.com/ar-io/ar-io-sdk/commit/0a1f22ebe7fccd6d7f77a5255d2b639d670492fb))

# [1.1.0](https://github.com/ar-io/ar-io-sdk/compare/v1.0.8...v1.1.0) (2024-06-03)


### Bug Fixes

* **api:** make evaluation options optional on the interface ([9e5a1c0](https://github.com/ar-io/ar-io-sdk/commit/9e5a1c0572486f9c1e417453fb9c54dd102cbdb4))
* **api:** remove unused variable for epochBlockHeight ([98c5ebc](https://github.com/ar-io/ar-io-sdk/commit/98c5ebc447b1b6d0249e0602ce7e4af97e424cc1))
* **arweave:** default to arweave.net ([84c9653](https://github.com/ar-io/ar-io-sdk/commit/84c9653be1fb92f8ed15da689d65ff19e5733ba4))
* **axios:** add back axios-retry ([9aae4de](https://github.com/ar-io/ar-io-sdk/commit/9aae4de1c23ca50acb613ff566e3f73c27f0ff0e))
* **errors:** throw AbortError on signal aborted ([63bd395](https://github.com/ar-io/ar-io-sdk/commit/63bd39566bc4ee08504b98b82c62dd22e100bc7f))
* **getContracts:** only implement util for now ([6b29c2f](https://github.com/ar-io/ar-io-sdk/commit/6b29c2ff7773320c2b6d16677826d59bd515332c))
* **gql query:** do not abstract the data protocol query ([f0b8f77](https://github.com/ar-io/ar-io-sdk/commit/f0b8f7718b777358d6b6946159f57551ea76c1e7))
* **imports:** import type from base route warp-contracts ([bf99a85](https://github.com/ar-io/ar-io-sdk/commit/bf99a85d0d099cf20db9b70db1bf84f9908b51e5))
* **init:** allow signer to be undefined and if so return readable ([b6a05e2](https://github.com/ar-io/ar-io-sdk/commit/b6a05e205c60c6b8623fbac6795a1e96a7a19590))
* **init:** fix type for init to allow undefined signer ([0a64ea9](https://github.com/ar-io/ar-io-sdk/commit/0a64ea9006571c93b4e9a26803b04d7da8ddcb9f))
* **init:** remove unnecessary destructuring ([81af1af](https://github.com/ar-io/ar-io-sdk/commit/81af1af7190f18726a20ebaaaa5712a4e815bb35))
* remove epochBlockHeight from interface ([b646f08](https://github.com/ar-io/ar-io-sdk/commit/b646f08e795635e4597d48d7c56419849c352a88))
* **types:** remove DataItem from WriteInteractionResult ([eadb1a1](https://github.com/ar-io/ar-io-sdk/commit/eadb1a1d61985caf1326c32d1205d3e8db309374))
* **types:** use gql node interface for dataProtocolTransaction ([79cebd9](https://github.com/ar-io/ar-io-sdk/commit/79cebd90b930829b740bed058f7cfe0da3b7799e))
* **warp:** ensure contract init on read interactions ([bc3d1b8](https://github.com/ar-io/ar-io-sdk/commit/bc3d1b84f99cf3341cea42641b58b792434ac405))


### Features

* **getContracts:** add get contracts on network specific providers like WarpContract ([603d36e](https://github.com/ar-io/ar-io-sdk/commit/603d36edd130d6b0410fa7199450ec91d7b4c821))
* **gql util:** add smartweave gql utils ([5ea3aab](https://github.com/ar-io/ar-io-sdk/commit/5ea3aaba1a5466741faa6e3b39d5908d25d37d49))
* **write:** add tags support to write interactions on warp-contract and saveObservations ([46eb4c9](https://github.com/ar-io/ar-io-sdk/commit/46eb4c91ba7c56cbeefde3b4fc2a522fda5fda1d))

## [1.0.8](https://github.com/ar-io/ar-io-sdk/compare/v1.0.7...v1.0.8) (2024-05-29)


### Bug Fixes

* **api:** add getPriceForInteration api to ario contract ([3b8083c](https://github.com/ar-io/ar-io-sdk/commit/3b8083c173bd35f7332c68dc094b092adedaf8e7))
* **bundle:** minify web bundle ([9266676](https://github.com/ar-io/ar-io-sdk/commit/9266676cc6cc26cc6829ef902329879e6f179fc4))
* **api:** use function map for method name ([439ec1f](https://github.com/ar-io/ar-io-sdk/commit/439ec1f649c2f54d6e1516ec4e7af5e8a080c2ed))
* **reserved:** add reserved arns name get methods ([ad203ef](https://github.com/ar-io/ar-io-sdk/commit/ad203ef22402851d28643630243716465b2ce030))
* **signer:** check if method is property of signer before using ([c52783c](https://github.com/ar-io/ar-io-sdk/commit/c52783c86bfa4019bc565dd457d7f14defdd1129))
* **signer:** modify signer to assume the signer type based on public key being undefined ([b775c96](https://github.com/ar-io/ar-io-sdk/commit/b775c9672ad68ac987bf37ec1cf0d7c625c9c426))
* **test:** add dockerfile for running tests in certain node environments ([86cf2ad](https://github.com/ar-io/ar-io-sdk/commit/86cf2ad51d09e88c13bdd0ba0e8a3a2b23b9d395))

## [1.0.7](https://github.com/ar-io/ar-io-sdk/compare/v1.0.6...v1.0.7) (2024-05-23)


### Bug Fixes

* **contract:** add extendLease and increaseUndernameSupport apis ([1b13b5e](https://github.com/ar-io/ar-io-sdk/commit/1b13b5e7e24259fbd2762848e6066822af51cecd))
* **types:** fix the AtLeastOne type ([ffd0869](https://github.com/ar-io/ar-io-sdk/commit/ffd0869949814196817d0ffb14fe0cf2be2ad298))
* **deps:** force arweavve to 1.15.1 ([2448598](https://github.com/ar-io/ar-io-sdk/commit/244859865b986a4c48b6446fc41230039cc5fcc0))
* **contract:** make params required - properties and note ([89db674](https://github.com/ar-io/ar-io-sdk/commit/89db674a187dffc83413ac1ac3922ca78ae3f88d))
* **types:** update tests and use overwrite type to allow mIOtoken for certain paramaters ([badcece](https://github.com/ar-io/ar-io-sdk/commit/badcece5ba33b3e26448988ae1aee88e706c9da5))
* **api:** change to increaseUndernameLimit ([9b72c1e](https://github.com/ar-io/ar-io-sdk/commit/9b72c1ed261ecae43fa4c0cd3e00ddb61e6e7ee5))
* **docs:** update ario apis ([4af0862](https://github.com/ar-io/ar-io-sdk/commit/4af08626abfe4cd16f6c4b56696e19c7803e7dc6))
* **tests:** update extend test util to include a test domain ([e959b7c](https://github.com/ar-io/ar-io-sdk/commit/e959b7cc3d642651c0313529ad47343e3ff2c69d))
* **token:** add mIO and IO token classes to exports ([f47f7d5](https://github.com/ar-io/ar-io-sdk/commit/f47f7d5c251973058866340a6bc2baddbf973ecf))
* **types:** add delegated gateway type ([c877496](https://github.com/ar-io/ar-io-sdk/commit/c87749660d2da62e6b996a9f034ce12fb702d93b))
* **types:** export the token types ([dfc83ae](https://github.com/ar-io/ar-io-sdk/commit/dfc83ae74a110dd06ddab16d5f88d192e4c0c5ad))
* **types:** remove visible types ([6ab1fc3](https://github.com/ar-io/ar-io-sdk/commit/6ab1fc3284d35fdd8f70a1fa1ac5cb7965878a51))
* **types:** update Gateway `delegates` type to use the new `GatewayDelegate` ([ac7e924](https://github.com/ar-io/ar-io-sdk/commit/ac7e924f24ba6133b2917de8416c37bf6560cdd4))
* **warp:** bump warp version ([db7344d](https://github.com/ar-io/ar-io-sdk/commit/db7344d269968a1f4a287eb2c2d503e0045fcf5e))

## [1.0.6](https://github.com/ar-io/ar-io-sdk/compare/v1.0.5...v1.0.6) (2024-05-07)


### Bug Fixes

* **warp:** bump warp to fix AbortError issue on warp imports for web ([c9a5613](https://github.com/ar-io/ar-io-sdk/commit/c9a561395da9cd0e04cc9320979c68f93ee99c0a))

## [1.0.5](https://github.com/ar-io/ar-io-sdk/compare/v1.0.4...v1.0.5) (2024-05-02)


### Bug Fixes

* **cjs:** provide path alias for warp in cjs export ([7f9bf9a](https://github.com/ar-io/ar-io-sdk/commit/7f9bf9a6c8937e855d6b56f81f367b596dfca166))
* **logger:** replace winston with bunyan ([0488f75](https://github.com/ar-io/ar-io-sdk/commit/0488f7529e25046d902ac88b11485a55bb246854))
* **util:** add FQDN regex that matches ArNS contract ([e6d7396](https://github.com/ar-io/ar-io-sdk/commit/e6d7396decdb4997aa121f31ae7ad87455747191))
* **utils:** manually convert from b64 to b64url to avoid web polyfill issues ([766035c](https://github.com/ar-io/ar-io-sdk/commit/766035c1a319e2c2567cf2a47bda3a48f5294d2c))
* **utils:** use base64 for fromB64url util ([42302ef](https://github.com/ar-io/ar-io-sdk/commit/42302ef5124aa28fc438a9b865fd901f2ed3df4d))
* **warp:** correctly throw error in write interaction ([c2368dd](https://github.com/ar-io/ar-io-sdk/commit/c2368dd5ef1c78fa52ef1eef3198a4a035411bea))

## [1.0.4](https://github.com/ar-io/ar-io-sdk/compare/v1.0.3...v1.0.4) (2024-04-30)


### Bug Fixes

* **ario:** update joinNetwork to accept observerWallet param ([6a32dd1](https://github.com/ar-io/ar-io-sdk/commit/6a32dd1d6291fc524a5c8ed88fc1bbe8c614a1e2))

## [1.0.3](https://github.com/ar-io/ar-io-sdk/compare/v1.0.2...v1.0.3) (2024-04-26)


### Bug Fixes

* **signer:** set owner before signing data ([0b558f5](https://github.com/ar-io/ar-io-sdk/commit/0b558f53b4b38dfea00629fd733462654801693c))

## [1.0.2](https://github.com/ar-io/ar-io-sdk/compare/v1.0.1...v1.0.2) (2024-04-25)


### Bug Fixes

* **arweave:** default to the arweave node import to avoid issues with browser environments ([fc8c26e](https://github.com/ar-io/ar-io-sdk/commit/fc8c26e3c33b27054ad69d6a406139d73283344f))
* **warp:** use default cache url in warpcontract ([a676a3c](https://github.com/ar-io/ar-io-sdk/commit/a676a3c952e9416f89b703519fb13b2d8671b82a))
* **init:** cleanup init overload methods and tests ([fa328d2](https://github.com/ar-io/ar-io-sdk/commit/fa328d26c7654221176dd57bda88ce56639048b6))
* **lint:** address lint issue in ArIOWriteable ([4a3ee89](https://github.com/ar-io/ar-io-sdk/commit/4a3ee893bc1121c7ed84108fa476d5a4308e0283))
* **tsconfig:** modify some tsconfig settings to get isolated configs for web/cjs/esm ([46b7acc](https://github.com/ar-io/ar-io-sdk/commit/46b7acc9bbe7cf52ddf3ed7d7e9399332b463fe5))
* **types:** make type guards accept unknowns ([7f285bb](https://github.com/ar-io/ar-io-sdk/commit/7f285bb73bebb384a0c20aafabc55e1fca76e34b))
* **types:** use generic types and modify the requirements for init functions ([9350f78](https://github.com/ar-io/ar-io-sdk/commit/9350f781dcadf481ebce7558cdecd6d27d43cc0c))
* **utils:** add writeInteraction types and update base64url logic ([4f5476b](https://github.com/ar-io/ar-io-sdk/commit/4f5476b093a303ffb68a7c26dad7b413334556ce))

## [1.0.1](https://github.com/ar-io/ar-io-sdk/compare/v1.0.0...v1.0.1) (2024-04-23)


### Bug Fixes

* **docs:** improve README docs interface documentation for ArIO clients ([b0da48c](https://github.com/ar-io/ar-io-sdk/commit/b0da48c77718020f79dc56fe04ca49a11f018fa6))

# 1.0.0 (2024-04-23)


### Bug Fixes

* **actions:** bump node setup action ([4eb49cd](https://github.com/ar-io/ar-io-sdk/commit/4eb49cda331cfef516639435e73dde2e90f2e05c))
* **actions:** freeze lockfile ([dba7313](https://github.com/ar-io/ar-io-sdk/commit/dba7313f42c8cf0053f90327ad2c14ec5bd4d4d7))
* **contract**add cache config in ario constructor ([1f3c0ba](https://github.com/ar-io/ar-io-sdk/commit/1f3c0baef2831d12d14d20e1ac16d9b0e8f0c978))
* **ant:** add ant contract to exports ([a2ff57b](https://github.com/ar-io/ar-io-sdk/commit/a2ff57bc1b6f77dcf9f3ace1fd3b346069aec6b4))
* **ant:** add signer to ant test ([4581b8d](https://github.com/ar-io/ar-io-sdk/commit/4581b8d461e57f4769befe5f650e5fe4e94bbc09))
* **ant:** default evaluation options for ant apis that do not take an… ([#25](https://github.com/ar-io/ar-io-sdk/issues/25)) ([0c8b55d](https://github.com/ar-io/ar-io-sdk/commit/0c8b55ddbc5019f365af43389524af5bd733d0c9))
* **ant:** default evaluation options for ant apis that do not take another parameter ([7c59033](https://github.com/ar-io/ar-io-sdk/commit/7c590334f6f99998839fecc78505e41931c80045))
* **ant:** default evaluation options for apis that do not require them ([72b57d5](https://github.com/ar-io/ar-io-sdk/commit/72b57d5626cbcda0931fd5f0b88bf113fbb05066))
* **ant:** fix API for getRecords ([c714aa3](https://github.com/ar-io/ar-io-sdk/commit/c714aa3563580c19427d55d6938893665ecc3ea2))
* **apis:** remove epoch from distributions and observations ([7b2d279](https://github.com/ar-io/ar-io-sdk/commit/7b2d2799d534378183122ef986fc3bd75755558e))
* **arbundle version:** pin version ([35ffab6](https://github.com/ar-io/ar-io-sdk/commit/35ffab6fbb9a2209391bb5f10120fb9a9c91b0aa))
* **arbundles:** update arbundles import ([f02d83f](https://github.com/ar-io/ar-io-sdk/commit/f02d83f4766a92be930a7c51e23f1f63b5692224))
* **ario:** add cache config in ario constructor ([#11](https://github.com/ar-io/ar-io-sdk/issues/11)) ([ecb279d](https://github.com/ar-io/ar-io-sdk/commit/ecb279d8a5d4381ecf29e8e3b94615ab7ae127aa))
* **ario:** formatting ([c61570a](https://github.com/ar-io/ar-io-sdk/commit/c61570ac609566d294d6c42b97ba65b91ef81d9c))
* **ario:** make state provider nullable and default to remote arns-service provider ([fa1cb72](https://github.com/ar-io/ar-io-sdk/commit/fa1cb728edc9ec072aa3c12595a3e5c93d84ca67))
* **ario:** re-add contract default config ([2296cc3](https://github.com/ar-io/ar-io-sdk/commit/2296cc3e152c136e2df45481340a625a80a0be3f))
* **ario:** remove unused cache property ([7f2d02e](https://github.com/ar-io/ar-io-sdk/commit/7f2d02eb3da96cea024ca2355668d5354dbeb767))
* **build:** add setImmediate polyfill for web only ([ad36776](https://github.com/ar-io/ar-io-sdk/commit/ad36776795348a32941d2b4e833ed00da05a476f))
* **build:** remove redundant exported type ([134319b](https://github.com/ar-io/ar-io-sdk/commit/134319b8707cd479dc91d6832bf078bdb5c5e886))
* **cache:** remove cache folder ([2ac9427](https://github.com/ar-io/ar-io-sdk/commit/2ac942742017344e1d8c06883449453c88bfa155))
* **cacheURL:** update ario cache url setting pattern to use custom url appropriately ([c76e67d](https://github.com/ar-io/ar-io-sdk/commit/c76e67dd8ecb7014cd441e7284df389e06ea5cc0))
* **cache:** validate arweave id before setting it ([5ba1175](https://github.com/ar-io/ar-io-sdk/commit/5ba1175b63b28e86f2b08a0de657a25546f46688))
* **casing:** revert to lower case casing ([b5da0ab](https://github.com/ar-io/ar-io-sdk/commit/b5da0ab78a965829951dbed7f4fcc5087b813271))
* **comments:** make class logger private, remove comments ([7483246](https://github.com/ar-io/ar-io-sdk/commit/7483246113d5b3b424f8450ea1f1c5e0d036618b))
* **connect:** add init static function on ario class to create interaction classes ([765f39c](https://github.com/ar-io/ar-io-sdk/commit/765f39c5816b35c41b43fdeddf765b9b50845b9a))
* **contract:** return cache url as well ([b4a7bc3](https://github.com/ar-io/ar-io-sdk/commit/b4a7bc3960be0532ec7cdedf5875128f11f60672))
* **contract:** correct contract function names ([ad9bc56](https://github.com/ar-io/ar-io-sdk/commit/ad9bc5625b582d5714624c491904e68380f10ae3))
* **contracts:** add configuration view method and update types ([4fae4a2](https://github.com/ar-io/ar-io-sdk/commit/4fae4a2688f96388d5b53d8fe292ff7942af0c57))
* **contracts:** remove write method and type from remote contract ([740d8b8](https://github.com/ar-io/ar-io-sdk/commit/740d8b88a5486f90cd61d024f8fdd4e6b9a370a0))
* **contract:** make contractTxID require in remote state cache instance ([dc82d21](https://github.com/ar-io/ar-io-sdk/commit/dc82d217c66ad8deff4ea6c3a9d7304f6e65b4d9))
* **contract:** make contractTxID required in remote state cache instance ([#10](https://github.com/ar-io/ar-io-sdk/issues/10)) ([bf651bb](https://github.com/ar-io/ar-io-sdk/commit/bf651bb11006eaf5eea586ff1feb0bb2644db504))
* **ctrl flow:** remove else from control flow ([4b3c4c2](https://github.com/ar-io/ar-io-sdk/commit/4b3c4c2058767b05199ac75c44c4684a66149bb9))
* **deps:** pin arweave ([d39391c](https://github.com/ar-io/ar-io-sdk/commit/d39391c19dc7d1396b735cd87920a2dc224f94e4))
* **deps:** remove axios-retry, will implement later ([0218e95](https://github.com/ar-io/ar-io-sdk/commit/0218e95fc2c2b1682010cf1841e3a2c717756c1d))
* **deps:** remove extra crypto-browserify ([9b42898](https://github.com/ar-io/ar-io-sdk/commit/9b4289809eacba3cd870adddb2bd73def576d50a))
* **deps:** remove warp-contracts-deploy from deps ([9d4f9fa](https://github.com/ar-io/ar-io-sdk/commit/9d4f9faa860789ced003dc3b6d36c4db99962b8e))
* **docs:** remove docs folder ([47e8403](https://github.com/ar-io/ar-io-sdk/commit/47e84037357fd69f9af18b1e9b84286257b49331))
* **drywrite:** throw on bad drywrite and continue if successful ([5052c0a](https://github.com/ar-io/ar-io-sdk/commit/5052c0a4deb06ac938d898d990e425dcc8ac6443))
* **eslintignore:** remove old file names ([415c163](https://github.com/ar-io/ar-io-sdk/commit/415c1632fc1d363894d17d4a335c7a0bbf78f3d8))
* **eslint:** remove eslint comments and use this signer ([32530eb](https://github.com/ar-io/ar-io-sdk/commit/32530eb777367b71bfba16bd97dcf6d6a75de791))
* **esm:** add polyfills for crypto ([dd8fbfe](https://github.com/ar-io/ar-io-sdk/commit/dd8fbfe5b373ba95ec406c1642e81ef520cdeddb))
* **esm:** add polyfills for crypto ([#27](https://github.com/ar-io/ar-io-sdk/issues/27)) ([553822c](https://github.com/ar-io/ar-io-sdk/commit/553822cab7ec8652efbc9545ef3c20c0312c38f0))
* **example web:** update ario instatiation ([77c6842](https://github.com/ar-io/ar-io-sdk/commit/77c68429af5e5a50f4ed2e8bd2bf7fdc67b8a2a6))
* **example:** escape quotes in packagejson for example package json ([fb47de0](https://github.com/ar-io/ar-io-sdk/commit/fb47de0336b33405d81992cfce8e9993d2531f8b))
* **example:** simplify example and remove unused method on remote cache ([81637f8](https://github.com/ar-io/ar-io-sdk/commit/81637f89c2eab304d7ccf11d1eac9503aa3d7592))
* **examples:** update comments and fix package.json ([db7140b](https://github.com/ar-io/ar-io-sdk/commit/db7140b815be1ea6fe1b270827fc4afb61707546))
* **examples:** update examples to use devnet ([cc037ac](https://github.com/ar-io/ar-io-sdk/commit/cc037ac5a3df2e76375679b8b14723c3b5d51fe2))
* **examples:** update examples with records methods, and balance methods ([a2d2a02](https://github.com/ar-io/ar-io-sdk/commit/a2d2a02befd64cff500932fe609b29d79ddf096c))
* **exports:** add arweavesigner and arconnectsigner to exports, clean up docs ([c7860ed](https://github.com/ar-io/ar-io-sdk/commit/c7860ed40d19ac43c091b6afd52db0402537e7ee))
* **exports:** update exports in indices ([f794437](https://github.com/ar-io/ar-io-sdk/commit/f79443732909fbc4c81d78957ca306bfb538caa3))
* **exports:** update package exports to have index in src folder ([2cce9e3](https://github.com/ar-io/ar-io-sdk/commit/2cce9e31efb2fd0bf8734d930deda301838da8d9))
* **files:** clean git cache of duplicate casing ([e9eaa2d](https://github.com/ar-io/ar-io-sdk/commit/e9eaa2d93122bad5008010c13710b5fa8bcd7533))
* **filters:** punt filters ([1c23cb3](https://github.com/ar-io/ar-io-sdk/commit/1c23cb3cf2ce8adc594fd2ba699e5ac32f4ef7b6))
* **fixture:** add type to arns state fixture ([5bcac32](https://github.com/ar-io/ar-io-sdk/commit/5bcac3211d78e08ead3e14da6e06aa41e9a65598))
* **formatting:** format ([3f30f77](https://github.com/ar-io/ar-io-sdk/commit/3f30f772a7571b9958f8a202128abd483da372b5))
* **gar write:** fix types and flow on gar write ([f5e7774](https://github.com/ar-io/ar-io-sdk/commit/f5e77741107b82df24c293a1cde37a4a907e1f4c))
* **gateway:** update gateway settings to support autostake ([82c6840](https://github.com/ar-io/ar-io-sdk/commit/82c68408fb562146053b9180dacc53fb490743ea))
* **generics:** use named generic ([4b647f0](https://github.com/ar-io/ar-io-sdk/commit/4b647f076b6cd3f4676f0bf7dbf6a5c020214e63))
* **gitignore:** remove cache from gitignore ([2867abc](https://github.com/ar-io/ar-io-sdk/commit/2867abcdba2fc4a4cece01c6ed3346065a54e2eb))
* **git:** test fix with file casing issue ([c3611ee](https://github.com/ar-io/ar-io-sdk/commit/c3611ee8fe9ef75ef2d91aa8bade99fee221c69a))
* **headers:** use source-version for header ([2b26d88](https://github.com/ar-io/ar-io-sdk/commit/2b26d888e176ed745fbc06fbe427993046d8cb18))
* **http:** add headers sdk headers to http config ([94810ed](https://github.com/ar-io/ar-io-sdk/commit/94810edb03272daccfbf05fb5625ba4aa3ee06f4))
* **husky:** add commit hooks ([885ce68](https://github.com/ar-io/ar-io-sdk/commit/885ce68c3b734ac95e1293078ce835333bc45d9f))
* **imports:** update to use indexed imports from warp ([1242568](https://github.com/ar-io/ar-io-sdk/commit/124256835e0137fb1332e0e7a670ccfaad8ef228))
* **indentation:** fix indentation in examples ([a266731](https://github.com/ar-io/ar-io-sdk/commit/a266731e14b480d04e3be1fa558de368f366682d))
* **interface:** removed filters and added base records types ([849834d](https://github.com/ar-io/ar-io-sdk/commit/849834db2c88ffc362c54f9844f936a1c8ab23dc))
* **interface:** rename interface to ContractCache ([2a0a765](https://github.com/ar-io/ar-io-sdk/commit/2a0a76546326d2a47f5cef1dde3c105f4deaad50))
* **jest:** remove extra config ([014fbde](https://github.com/ar-io/ar-io-sdk/commit/014fbde09f4c533c957d6372345616c13df2a29d))
* **lint:** disable no-any warning certain types ([de5f108](https://github.com/ar-io/ar-io-sdk/commit/de5f10874e6bf2deaca89d35ac11e1a11a64ad59))
* **lint:** formatting ([21224e2](https://github.com/ar-io/ar-io-sdk/commit/21224e2f47605d1959853c99ddb1c8a3df6a0d7d))
* **logger, errors, http:** Updated to axios and axios-retry, added winston logger, more extensive custom error objects ([b944f4d](https://github.com/ar-io/ar-io-sdk/commit/b944f4db494531a346ab025e28a8a6cd46f5d546))
* **logger:** remove unused logger property ([9501d1d](https://github.com/ar-io/ar-io-sdk/commit/9501d1d3571980fb4e157c022e0ea0f8e60f9a0a))
* **logs:** removing debug logs ([f025171](https://github.com/ar-io/ar-io-sdk/commit/f025171586e2f440ef92550ddf37c5254db86a44))
* **mixin:** filter private methods in mixin util ([beb8610](https://github.com/ar-io/ar-io-sdk/commit/beb8610807038a7fc51baaa266db1435781c6e8c))
* **naming:** change epoch to epochStartHeight ([908971c](https://github.com/ar-io/ar-io-sdk/commit/908971c273aaac20ab320e867ec1e790706a11f3))
* **naming:** rename getRecord[s] to getArNSRecord[s] ([bd3d4bc](https://github.com/ar-io/ar-io-sdk/commit/bd3d4bc25a7528ba9f093a96cf0ed33439160d27))
* **overloads:** only accept warp contract as a contract config for ariowritable ([e3c97e9](https://github.com/ar-io/ar-io-sdk/commit/e3c97e9eaddc98e704a2192bcae6dfdee42f7ae6))
* **polyfills:** rollback polyfill on logger ([0cdb2f0](https://github.com/ar-io/ar-io-sdk/commit/0cdb2f0a1e23c111b57f788f51780f98f186ec7d))
* **postinstall:** remove husky postinstall script ([c74a135](https://github.com/ar-io/ar-io-sdk/commit/c74a13591c75271352135f8c30055623cf536ed2))
* **readme:** add grammar and example recs ([ecc07f7](https://github.com/ar-io/ar-io-sdk/commit/ecc07f7f5c89fd8fbe66d2b79db44a62285057d4))
* **readme:** condense quick start ([b35e5bd](https://github.com/ar-io/ar-io-sdk/commit/b35e5bd94e950255a15c1bf0ffa1bf1aa47a3395))
* **readme:** refactor api list to header tags ([817d99b](https://github.com/ar-io/ar-io-sdk/commit/817d99b05d45caf435fdfe26065a70407f0bce56))
* **readme:** update ant header ([77235ce](https://github.com/ar-io/ar-io-sdk/commit/77235ce077ef4a12dfa6b403968b6ab148ebf196))
* **readme:** update ANT usage description ([70c8520](https://github.com/ar-io/ar-io-sdk/commit/70c852087f75a17c494cc12719d1dc9f96da39f2))
* **readme:** update joinNetwork docs ([9fcf440](https://github.com/ar-io/ar-io-sdk/commit/9fcf440d2ed2f71005f1e9bd3b0a7691aae90a63))
* **readme:** update quick start ([a60d96a](https://github.com/ar-io/ar-io-sdk/commit/a60d96a821b5e77a68b7682c5e74e5dc01ca2f28))
* **readme:** update readme with default provider example ([68a5a16](https://github.com/ar-io/ar-io-sdk/commit/68a5a1697ae0c4c6797ef355f887408d72030cf8))
* **readme:** update readme with examples ([d9ee23e](https://github.com/ar-io/ar-io-sdk/commit/d9ee23eb99d9d845098324dba77497284942f35c))
* **record records:** update key to use result instead of record ([90314db](https://github.com/ar-io/ar-io-sdk/commit/90314dbdb91806222a7e822951a89aaeea5596ed))
* **records:** remove contractTxId filter remove lodash shrink readme ([50669e1](https://github.com/ar-io/ar-io-sdk/commit/50669e1e203d038dfcf3a0e30d7637122d4b4777))
* **records:** use state endpoint to fetch records ([2f02c53](https://github.com/ar-io/ar-io-sdk/commit/2f02c53d990dffe526de96e762ddbcbf1b3a8770))
* **recs:** modify the interfaces for contracts and implement with warp and remote service ([#13](https://github.com/ar-io/ar-io-sdk/issues/13)) ([56ebb08](https://github.com/ar-io/ar-io-sdk/commit/56ebb08616e4002a8037747dcd5e9e070dae6a0d))
* **release:** remove release assets entirely ([9d5a1b3](https://github.com/ar-io/ar-io-sdk/commit/9d5a1b3b693134062754892674428936df122c9b))
* **release:** update github release config to publish packages to github ([5534d9d](https://github.com/ar-io/ar-io-sdk/commit/5534d9d6c9b86b1642668705dc0cb6c301f03d9e))
* **remote:** getState not properly setting evalTo in http requests ([55745c1](https://github.com/ar-io/ar-io-sdk/commit/55745c1881af9ea93a0545e1b04eaff210257802))
* **safety:** update type safety checks ([32eebbc](https://github.com/ar-io/ar-io-sdk/commit/32eebbc21a4592384dd6fed3247f0e00292b6471))
* **deps:** make set immediate a build dependency as it is required by the node winston ([9292eaa](https://github.com/ar-io/ar-io-sdk/commit/9292eaab29c3c955d1c981d6d22fa6e11da55500))
* **signer:** check that contract is connected before trying to write ([d352e9c](https://github.com/ar-io/ar-io-sdk/commit/d352e9c7ac1038caa238df21d1165345c64d61de))
* **signer:** check that contract is connected before trying to write ([#29](https://github.com/ar-io/ar-io-sdk/issues/29)) ([536a116](https://github.com/ar-io/ar-io-sdk/commit/536a116c1cfecd1bfbe1ffc9d5fe87ab4006a81c))
* **signer:** fix signer in WarpContracts - update tests ([ea9448f](https://github.com/ar-io/ar-io-sdk/commit/ea9448f3440c58811891fa37db2ceb7948b8d200))
* **signer:** fix signer in WarpContracts - update tests ([#32](https://github.com/ar-io/ar-io-sdk/issues/32)) ([16d69d8](https://github.com/ar-io/ar-io-sdk/commit/16d69d8a996d0692b28c956d7ec7f38245ff2f6b))
* **signer:** remove jwk use, ignore web example for now ([bc7e577](https://github.com/ar-io/ar-io-sdk/commit/bc7e577e0f7f42a91ae4bbca853addf7f178a1f8))
* **signer:** remove signer, will do in other pr ([d02276d](https://github.com/ar-io/ar-io-sdk/commit/d02276dd9fa166d254eb76a45e2c6025f632c0ba))
* **signer:** remove use of JWK, simplify constructor ([#22](https://github.com/ar-io/ar-io-sdk/issues/22)) ([d2ef573](https://github.com/ar-io/ar-io-sdk/commit/d2ef5732d1ef268d9fb1420c96f520b0fcb4bedd))
* **signer:** update ANT to have signer ([c7f8eee](https://github.com/ar-io/ar-io-sdk/commit/c7f8eeec4c2141548d202f76934304a310b177b7))
* **structure:** update cache provider folder to be named caches ([844c1aa](https://github.com/ar-io/ar-io-sdk/commit/844c1aab722316db14167f22a397858a2c9c6bbf))
* **structure:** use snake case for file and folder names ([37f27d3](https://github.com/ar-io/ar-io-sdk/commit/37f27d3b6a526a37a88ccbf7480f4bc6dc06153f))
* **tests:** use beforeAll to read env vars ([95cc019](https://github.com/ar-io/ar-io-sdk/commit/95cc0194ffd9b04a0e389557ad39e53cfa87c443))
* **tests:** add test cases as a const ([8458185](https://github.com/ar-io/ar-io-sdk/commit/845818528fc5364971738fa549173f6f019065c0))
* **tests:** add test for custom arIO client config ([0e6142b](https://github.com/ar-io/ar-io-sdk/commit/0e6142bedaffbf86e79840d830499d4e1aacbced))
* **tests:** change control flow pattern to .catch instead of trycatch ([883de51](https://github.com/ar-io/ar-io-sdk/commit/883de51f85f32807a62f189b00ac485ecfdcfd69))
* **tests:** dont make blockHeight or sortKey undefined but rather evalTo ([f76a201](https://github.com/ar-io/ar-io-sdk/commit/f76a201eb53069f611b17bfef01506143fdec080))
* **tests:** instantiate new ant to connect in tests ([9869415](https://github.com/ar-io/ar-io-sdk/commit/98694156a55a5dfba2a96cb09b4f734c33ed0c64))
* **tests:** remove dryWrite from writeInteraction, update tests ([bc1becc](https://github.com/ar-io/ar-io-sdk/commit/bc1becc1597b11c80d56b21d9a7137e170b69399))
* **tests:** remove fixture and use live service for tests ([30d3e8c](https://github.com/ar-io/ar-io-sdk/commit/30d3e8cddc1f85f19467af19d191558575351e63))
* **tests:** test 404 response ([590dea6](https://github.com/ar-io/ar-io-sdk/commit/590dea6c6285bd8c786c02dcdbdc85fba7364fc6))
* **tests:** update ario test ([4208bd0](https://github.com/ar-io/ar-io-sdk/commit/4208bd023c9f1026a49a5bea3a06beb51a3494b7))
* **tests:** update client instantiation test to check read vs write clients ([059653c](https://github.com/ar-io/ar-io-sdk/commit/059653c38ed78aa305a796bcf8a18a119c83d63c))
* **tests:** update docker compose params ([a71befd](https://github.com/ar-io/ar-io-sdk/commit/a71befd8b06e18181f52ca78babe878196f3673f))
* **tests:** update gateways test ([1fcb3e6](https://github.com/ar-io/ar-io-sdk/commit/1fcb3e6c52c47d5c2e9b7df32eff944ec511fec6))
* **tests:** update stubs in tests ([e4bbc6e](https://github.com/ar-io/ar-io-sdk/commit/e4bbc6e691fec0f60c0ff84c4ead9620dcc28739))
* **tests:** update test to match jest syntax ([553bdbb](https://github.com/ar-io/ar-io-sdk/commit/553bdbb2aaff0a26a0aeaa34c9ec614379d30dca))
* **tests:** update tests for named prop expectation ([4ea04a7](https://github.com/ar-io/ar-io-sdk/commit/4ea04a735ec8c0a0c0cc8859d7bfa42bd6f9110e))
* **tests:** update tests to use younger contract, add evalParams config ([ae890c8](https://github.com/ar-io/ar-io-sdk/commit/ae890c85f5fca785f88c60a751fb617b2389de61))
* **tests:** update tests with constants and update types ([1bdcfeb](https://github.com/ar-io/ar-io-sdk/commit/1bdcfebae93123aa46f500ebbd9693d3e1e36ef6))
* **tests:** update tests with new name ([2cd1b5c](https://github.com/ar-io/ar-io-sdk/commit/2cd1b5ce18ed63c2b787d70e7e502aade26315eb))
* **tests:** update with new names on methods ([619c193](https://github.com/ar-io/ar-io-sdk/commit/619c193d210536a2e4ee1308805ce348298b42c8))
* **tests:** use angela for testing ([10f30fe](https://github.com/ar-io/ar-io-sdk/commit/10f30fe0770cb2cfef4f0a2ce18a4c5e4fe5ce77))
* **tests:** use http not https in tests ([fddba1e](https://github.com/ar-io/ar-io-sdk/commit/fddba1e34c9a195cb6a5cdcf3ec6f3dcbd41524c))
* **tests:** use process vars as priority url ([faab4f3](https://github.com/ar-io/ar-io-sdk/commit/faab4f3ee7624828cb25a32b6ecfb655cd5c1fc5))
* **test:** update test to use ArweaveTransactionID class ([f6c4f8b](https://github.com/ar-io/ar-io-sdk/commit/f6c4f8ba23a921eba281596b29dff3fece82b322))
* **tsconfig:** reverted tsconfig to nodenext resolution, changed naming convention on provider, removed extraeneous error classes, rolled back axios-retry to match our tsconfig settings ([d412d44](https://github.com/ar-io/ar-io-sdk/commit/d412d44dc9fd71fe6a81deb37e99b8c24f6b4661))
* **types:** set types to objects rather than top level params for easier readability ([edfd77b](https://github.com/ar-io/ar-io-sdk/commit/edfd77bb01f38c21f2e96aacaea07705372fe664))
* **types:** rename all type implementations ([5959045](https://github.com/ar-io/ar-io-sdk/commit/595904509e152188eeadb07fbf57495b941a45bf))
* **types:** update evalTo to allow undefined sortKey and block and test that ([a59f05c](https://github.com/ar-io/ar-io-sdk/commit/a59f05c8669750b59b01ee140bcd84d91b9cfaf8))
* **types:** add @ to records ([53601c1](https://github.com/ar-io/ar-io-sdk/commit/53601c1d08f7bf3e522f25b58e514b0c809ad195))
* **types:** make props nullable on certain read apis ([f8ff552](https://github.com/ar-io/ar-io-sdk/commit/f8ff552ed6de9516476e74e6aad92e72a8d3adb3))
* **types:** remove any type ([5c80242](https://github.com/ar-io/ar-io-sdk/commit/5c8024261b5e13ee4f4d697b545a710b7cf136d1))
* **types:** remove any types ([d8d910b](https://github.com/ar-io/ar-io-sdk/commit/d8d910b9f2d0b95232ccf3c52e74f57b086df435))
* **types:** remove ArweaveTransactionID type for now ([3adf53b](https://github.com/ar-io/ar-io-sdk/commit/3adf53bd54041bc5dbc6956586bfebcfe66bd71c))
* **types:** remove unnecesssary empty defaults ([7d14edb](https://github.com/ar-io/ar-io-sdk/commit/7d14edb55c7db6a949d717fe19ffe1ae87916a9d))
* **types:** rename signer to ContractSigner ([87d6c90](https://github.com/ar-io/ar-io-sdk/commit/87d6c90b625b8bb97d68ea89d63d7a97ea894051))
* **types:** require atleast one param to update gateway settings ([857ebdc](https://github.com/ar-io/ar-io-sdk/commit/857ebdc1b0dd39d5b12943f9b15dd0ddb9b5785e))
* **types:** update interaction type to only use read for now ([2c02e90](https://github.com/ar-io/ar-io-sdk/commit/2c02e90076bc0fe8580bef041cd7c07e65db43d9))
* **types:** update tests, readme, and types ([e9985dd](https://github.com/ar-io/ar-io-sdk/commit/e9985ddada117561f8e666d133b3d573e0beef3e))
* **types:** use partial write type ([fa6a638](https://github.com/ar-io/ar-io-sdk/commit/fa6a638ae9d69b234b264c3e510c09709fc56fd8))
* **types:** use string instead of any ([014a262](https://github.com/ar-io/ar-io-sdk/commit/014a26210b2482b3aa5150b4fd37925760f39dd8))
* **utils:** make validator a private method ([dce4a94](https://github.com/ar-io/ar-io-sdk/commit/dce4a948e38ae0f6af3658dcb066861c766f5ed9))
* **utils:** isBlockheight check more strict ([2b28675](https://github.com/ar-io/ar-io-sdk/commit/2b28675fabb97be0cadfbc8a47241b0bcc5bd9fd))
* **warp:** added test for getting state after connecting with warp ([060ee2c](https://github.com/ar-io/ar-io-sdk/commit/060ee2c4a8bc21c345eb6ab006c3da41b29ff7d5))
* **warp:** provide logger - update isTransaction flow ctrl - use typed props ([5f6e0a1](https://github.com/ar-io/ar-io-sdk/commit/5f6e0a17662e43d4b2d560fcd505a07e006a308b))
* **warp:** bump warp to 1.4.38 - fixed warp exports ([af4a20b](https://github.com/ar-io/ar-io-sdk/commit/af4a20b0df97867327bdfea12f4eb1956d531352))
* **winston:** move the winston polyfill - this will prevent any esm based web projects from getting polyfill issues ([c8b7998](https://github.com/ar-io/ar-io-sdk/commit/c8b7998db824506c1e213557e859604d903aab9c))
* **write:** add dry run - sync state - abortSignal - update interface ([970bdef](https://github.com/ar-io/ar-io-sdk/commit/970bdefaff2eea93e3c0783dccafd6276a80ea03))
* **write:** update utils - change error flow - update arweave constructor props ([0a81c92](https://github.com/ar-io/ar-io-sdk/commit/0a81c920e82c03beba7dad41c189c00e128ced10))
* **write:** update write methods on warp ([9c0540b](https://github.com/ar-io/ar-io-sdk/commit/9c0540b1f98af68ada417e1e052d282a1c93fb07))
* **yarn:** update lockfile ([fd5e0ee](https://github.com/ar-io/ar-io-sdk/commit/fd5e0ee013a40568e88a06ff4ac1e630559a68c0))


### Features

* **ant:** add ANT read interface ([c941c96](https://github.com/ar-io/ar-io-sdk/commit/c941c96cd201983270cc9e04c0fcaa5b4dc3b798))
* **ant:** create ant contract class for interacting with ant contracts ([6eb7ef5](https://github.com/ar-io/ar-io-sdk/commit/6eb7ef5ed7f0ec3e64e0c18e97a708d7c528ff21))
* **ants:** add readable-writable framework to the ant client and implement write methods ([3019f53](https://github.com/ar-io/ar-io-sdk/commit/3019f53953d362629a34c6282012b58de1171b23))
* **contract:** add distributions and observation apis ([21e38d1](https://github.com/ar-io/ar-io-sdk/commit/21e38d1229e640a1cec685f491b1b07b84ee6a56))
* **contract:** update ArIO interface and ArIOContract interface ([5d87e2e](https://github.com/ar-io/ar-io-sdk/commit/5d87e2e9b707e30caaf960585e3300efbab420bb))
* **auctions:** add auctions apis ([faf08c5](https://github.com/ar-io/ar-io-sdk/commit/faf08c51f3b499e158e96cc2a0b97a06a20c6f8c))
* **contract:** add distribution, observations apis, update readme and examples ([0208317](https://github.com/ar-io/ar-io-sdk/commit/0208317c211d659afbbc55d06345a0c33cd076eb))
* **contract:** create new contract classes that impelement both warp and remote cache for ant contract and ar-io contracts ([855da2d](https://github.com/ar-io/ar-io-sdk/commit/855da2d1ce53ade61025e9a2513ac706e362e0b1))
* **docs:** setup examples, readme, and initial gateways provider ([5a9e232](https://github.com/ar-io/ar-io-sdk/commit/5a9e2320219b8b61dec1cf8d0ecb74562b9ebed0))
* **contract:** add gar write methods to the ario client ([e01b08b](https://github.com/ar-io/ar-io-sdk/commit/e01b08beccb64112ae4ec333e9a5a2ea872b816f))
* **contract:** scaffold initial providers ([4949514](https://github.com/ar-io/ar-io-sdk/commit/4949514a334eda107c87c77bef87ec839144c99f))
* **contract:** add transfer api to ario writable client ([0d37623](https://github.com/ar-io/ar-io-sdk/commit/0d37623bdf0a460242ac8d2b6f819f686fb2cbce))
* **contract:** add `saveObservations` write interaction ([8dd977c](https://github.com/ar-io/ar-io-sdk/commit/8dd977c55091b038c6b4a1b30fbeed5bc816f433))
* **observers:** add API for fetching prescribed observers ([a18e130](https://github.com/ar-io/ar-io-sdk/commit/a18e1306b185143b3b44416da168bf0610418d9c))
* **observers:** add API for fetching prescribed observers ([#17](https://github.com/ar-io/ar-io-sdk/issues/17)) ([17ce6de](https://github.com/ar-io/ar-io-sdk/commit/17ce6de4aea61e5f97c999cdc96011dd911f7ad6))
* **PE-5742:** add records api to arns remote cache ([#8](https://github.com/ar-io/ar-io-sdk/issues/8)) ([c46cd39](https://github.com/ar-io/ar-io-sdk/commit/c46cd3968efe31f9dac3c6368b073b97adfaeb2a))
* **PE-5751:** add blockheight and sortkey eval filters ([#12](https://github.com/ar-io/ar-io-sdk/issues/12)) ([832a1ad](https://github.com/ar-io/ar-io-sdk/commit/832a1ad20f06407f21d87ad38111f1bae794efbc))
* **PE-5758:** add signer to ario class ([#20](https://github.com/ar-io/ar-io-sdk/issues/20)) ([1b82077](https://github.com/ar-io/ar-io-sdk/commit/1b820774104d90f2bcbec9a18c8fbca891616f7b))
* **PE-5759:** observations and distributions apis ([#16](https://github.com/ar-io/ar-io-sdk/issues/16)) ([dded361](https://github.com/ar-io/ar-io-sdk/commit/dded3619784561b416297855724fc5924a1cd1d0))
* **PE-5773:** add auctions read apis ([#18](https://github.com/ar-io/ar-io-sdk/issues/18)) ([e0c6fca](https://github.com/ar-io/ar-io-sdk/commit/e0c6fca49788b361478aca85d3dae3ca96f6aa97))
* **PE-5800:** add epoch apis ([48ee4ba](https://github.com/ar-io/ar-io-sdk/commit/48ee4ba04e162c09e0d75c0194119fa9c76649d4))
* **PE-5800:** epoch apis ([#15](https://github.com/ar-io/ar-io-sdk/issues/15)) ([70563b1](https://github.com/ar-io/ar-io-sdk/commit/70563b18f07a31d001cc4610297182860536c2df))
* **PE-5825:** ANT read interface ([#19](https://github.com/ar-io/ar-io-sdk/issues/19)) ([6a0c477](https://github.com/ar-io/ar-io-sdk/commit/6a0c47754689071d292eaebfa7b3af6c8e851fa4))
* **records:** add records api to arns remote cache ([1b7f54f](https://github.com/ar-io/ar-io-sdk/commit/1b7f54fb04d8fe390345eb47a3402744e2293709))
* **signer:** add arweave signer to ario class ([7e08097](https://github.com/ar-io/ar-io-sdk/commit/7e08097e9abccf4a57673209751b2cd2fc25b746))
* **write:** add write interface and base implementation on warp-contract ([6dfc969](https://github.com/ar-io/ar-io-sdk/commit/6dfc969a23dd965fe169edeacf117aed8e59d642))
