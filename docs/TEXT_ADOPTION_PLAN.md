# 111 Network — Text Adoption Plan

> Goal: Replace all template text with 111 Network-specific copy.
> Design, layout, animations, and components stay exactly as-is.
> Only text strings change.

---

## 1. Navigation

| Element | Current (Template) | Proposed (111 Network) |
|---------|-------------------|------------------------|
| Logo | `MONO_HUB` | `111.network` |
| Nav links | 01 KERNEL & SYSTEMS ... 08 HARDWARE ABSTRACTION | Keep structure, text TBD per section below |

---

## 2. Hero Section

| Element | Current (Template) | Proposed (111 Network) |
|---------|-------------------|------------------------|
| Badge | `FRONTEND ENGINEERING SHOWCASE` | `V.0.0.5 Experimental` |
| Headline line 1 | `Raw Logic.` | `Free, Secure` |
| Headline line 2 | `Refined Form.` | `Communication for Everyone` |
| Description | `An exclusive showcase of high-performance frontend engineering and character-based art. Eight specialized modules exploring the intersection of code and aesthetics.` | `A global message network that runs on people, not servers. Works with phones, radios, satellites — anything that can carry a message. No company. No government. Just you and the world.` |
| Primary CTA | `Explore the Modules` | `Explore the Network` |
| Secondary CTA | `Clone the Repo` | `View on GitHub` |
| Terminal header | `monochrome-hub ~ v1.0.0` | `111-network ~ v0.0.5` |
| Terminal boot lines | `> initializing ascii_renderer... > loading 8 technical modules...` etc. | `> initializing mesh_protocol... > discovering nearby nodes... > transport: radio, phone, email, satellite [OK] > encryption: end-to-end [ENABLED] > status: OPERATIONAL > _` |
| Scroll indicator | `Scroll to Explore` | `Scroll to Explore` |

---

## 3. Tech Ticker

| Current (Template) | Proposed (111 Network) |
|-------------------|------------------------|
| Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion, Geist Font, Vercel, Node.js, WebAssembly, Rust, Go, Linux Kernel, Docker, Kubernetes, gRPC, PostgreSQL | Mesh Network, P2P, End-to-End Encryption, Store & Forward, Offline First, Radio, Satellite, Open Source, Cross-Platform, No Internet Required, Anonymous, Decentralized, Community Built, Global Reach, Resilient |

---

## 4. Eight Domain Sections

### Section 01 — The Protocol (was: Kernel & Systems)

| Element | Current (Template) | Proposed (111 Network) |
|---------|-------------------|------------------------|
| Number | `01` | `01` |
| Title | `Kernel & Systems` | `The Protocol` |
| Subtitle | `Low-level architecture` | `Core mesh architecture` |
| Description | `Exploring the foundational layer where hardware meets software. Kernel modules, system calls, and memory management form the backbone of every computing experience.` | `The foundational layer where messages meet the mesh. Routing tables, store-and-forward buffers, and transport adapters form the backbone of every connection.` |
| Terminal title bar | `kernel@monochrome:~` | `protocol@111-network:~` |
| Terminal shell version | `bash 5.2.15` | `mesh v0.0.5` |
| Boot Sequence label | `Boot Sequence` | `Network Bootstrap` |
| Boot lines | `[ 0.000000] Linux version 6.1.0-monochrome...` | `[ 0.000] 111 Protocol v0.0.5 initializing... [ 0.012] Transport adapters: radio, phone, email, satellite [ 0.034] Mesh routing table seeded [ 0.089] Store-and-forward buffer: 16384 slots [ 0.204] Encryption keys generated [ 0.340] Peer discovery broadcast sent [ 0.420] NET: 3 neighbors found [ 0.510] Status: MESH ONLINE` |
| System Overview label | `System Overview` | `Protocol Overview` |
| Architecture Schematic label | `Architecture Schematic` | `Network Stack` |
| ASCII art | Kernel space / user space diagram | TBD — protocol stack layers |
| Specs (4 pairs) | Architecture: x86_64 / ARM64, Scheduler: CFS, Memory Model: Virtual Paging, IPC: Pipes/Sockets/Shared Mem | Routing: Store & Forward, Encryption: End-to-End, Transport: Multi-Channel, Range: Device-to-Device |

---

### Section 02 — The Mesh (was: Network Topologies)

| Element | Current (Template) | Proposed (111 Network) |
|---------|-------------------|------------------------|
| Number | `02` | `02` |
| Title | `Network Topologies` | `The Mesh` |
| Subtitle | `Distributed connectivity` | `Peer-to-peer connectivity` |
| Description | `Mapping the invisible infrastructure that connects billions of nodes. From mesh networks to star topologies, understanding how data traverses the physical and logical layers.` | `Mapping the invisible web of people and devices that carry messages across the world. From phone to phone, radio to radio — every node strengthens the whole.` |
| LIVE indicator | `LIVE` | `LIVE` |
| Metrics | Nodes Online 7/8, Throughput 9.2 Gbps, Latency p99 8.4ms, Packet Loss 0.001% | Nodes Active 7/8, Messages/Hour 1,247, Avg Hops 6.2, Packet Loss 0.001% |
| Specs | Protocol: TCP/IP Stack, Topology: Hybrid Mesh, Latency: < 10ms p99, Bandwidth: 10 Gbps | Protocol: 111 Mesh v0.0.5, Topology: Hybrid Mesh, Latency: Variable (hops), Redundancy: Path Diversity |

---

### Section 03 — Distributed Ledger (was: Distributed Ledger)

| Element | Current (Template) | Proposed (111 Network) |
|---------|-------------------|------------------------|
| Number | `03` | `03` |
| Title | `Distributed Ledger` | `Distributed Ledger` |
| Subtitle | `Consensus architecture` | `Network state layer` |
| Description | `Decentralized systems where trust is computed, not assumed. Examining consensus mechanisms, Merkle trees, and the cryptographic primitives that secure distributed state.` | `The 111 Network uses a distributed ledger to anchor public messages, verify identity claims, and eventually secure the full message database. Trust is computed, not assumed. Every public shout is a signed entry. Every node validates.` |
| Block cards | Block #1020-1024 with hash/prev/nonce/tx | Block #1020-1024 with hash/prev/nonce/tx (keep blockchain visual) |
| Block Inspector label | `Block Inspector` | `Block Inspector` |
| Inspector fields | Height, Hash, Previous, Nonce, Transactions | Height, Hash, Previous, Nonce, Messages |
| Specs | Consensus: Proof of Stake, Block Time: ~12 seconds, Hash Function: SHA-256, Finality: 2 epochs | Consensus: Proof of Stake, Block Time: ~12 seconds, Hash Function: SHA-256, Finality: 2 epochs |

---

### Section 04 — Private Messages (was: Compiler Design)

| Element | Current (Template) | Proposed (111 Network) |
|---------|-------------------|------------------------|
| Number | `04` | `04` |
| Title | `Compiler Design` | `Private Messages` |
| Subtitle | `Language transformation` | `End-to-end encryption` |
| Description | `The art of translating human intent into machine execution. Lexical analysis, parsing, AST transformation, and code generation form the pipeline that bridges abstraction and silicon.` | `Message people directly. Only you and the other person can read what's sent. No one else. Messages hop between nearby devices until they find a way to the intended user. The more users, the faster and wider the range.` |
| Tab names | SOURCE, TOKENS, AST, IR, ASM | PLAIN, ENCRYPT, ROUTE, DELIVER, READ |
| Tab labels | Source Code, Lexer Output, Abstract Syntax Tree, Intermediate Repr., Machine Code | Your Message, Encrypted Packet, Route Selection, Delivery Path, Decrypted Read |
| Stage 1 code | Fibonacci function source | A plain text message example |
| Stage 2 code | Token stream | Encrypted packet representation |
| Stage 3 code | AST tree | Route selection logic |
| Stage 4 code | LLVM IR | Delivery path trace |
| Stage 5 code | x86 assembly | Decrypted message output |
| Pipeline Info label | `Pipeline Info` | `Encryption Pipeline` |
| Source/Binary labels | `Source` / `Binary` | `Plain` / `Secure` |
| Specs | Frontend: Recursive Descent, IR: SSA Form, Optimization: LLVM Pass Pipeline, Target: x86_64 / WASM | Encryption: E2E (NaCl), Delivery: Best Effort, Max Size: 64 KB, Expiry: 30 days |

---

### Section 05 — Offline Mode (was: Graphics Pipelines)

| Element | Current (Template) | Proposed (111 Network) |
|---------|-------------------|------------------------|
| Number | `05` | `05` |
| Title | `Graphics Pipelines` | `Offline Mode` |
| Subtitle | `Rendering architecture` | `No internet required` |
| Description | `From vertices to pixels, the graphics pipeline transforms mathematical abstractions into visual reality. Shaders, rasterization, and GPU compute redefine what screens can display.` | `No bars? No Wi-Fi? No problem. Messages travel through phones, laptops, plug-in devices, even homemade tools. If someone nearby is connected, they help move messages for others too.` |
| Signal label | `SIGNAL — GPU WAVEFORM` | `SIGNAL — MESH ACTIVITY` |
| Pipeline stages | Input Assembly, Vertex Shader, Rasterizer, Fragment Shader, Output Merger | Store Message, Find Next Hop, Buffer & Wait, Forward When Able, Deliver to Recipient |
| Stage icons/descs | IA/Vertex data, VS/Transform, RS/Triangles->frags, FS/Per-pixel color, OM/Depth test + blend | SM/Store locally, NH/Find neighbor, BW/Wait for path, FW/Relay forward, DR/Hand off |
| Specs | API: Vulkan/WebGPU, Shading: PBR Cook-Torrance, Resolution: 4K@120Hz, Draw Calls: <1000/frame | Storage: Local Buffer, Range: 100m - 10km, Power: Low Energy, Fallback: Any Transport |

---

### Section 06 — Multi-Transport (was: Logic Synthesis)

| Element | Current (Template) | Proposed (111 Network) |
|---------|-------------------|------------------------|
| Number | `06` | `06` |
| Title | `Logic Synthesis` | `Multi-Transport` |
| Subtitle | `Digital design` | `Any way it can` |
| Description | `Where Boolean algebra meets silicon. Logic gates, flip-flops, and RTL design form the bridge between abstract computation theory and physical circuit implementation.` | `Messages are packed so they can travel via radios, phones, email, satellite tools. Smart routing picks the best path available. If one channel is down, the message finds another.` |
| Interactive label | `Interactive Logic Gate` | `Transport Selector` |
| Input toggles | A, B, C, D | Radio, Phone, Email, Satellite |
| Gate labels | A & B / AND / OR / C & D / AND | A & B / AND / OR / C & D / AND (do not touch, keep as is) |
| Formula | `Q = (A AND B) OR (C AND D)` | `route = any_available(transport[])` |
| Clock Signal label | `Clock Signal` | `Signal Strength` |
| Data Sheet label | `Data Sheet` | `Transport Specs` |
| Specs | HDL: SystemVerilog, Process: 5nm FinFET, Clock: 3.2 GHz, Gates: ~10B transistors | Channels: Radio / Phone / Email / Satellite, Fallback: Auto-Switch, Packet Size: 256 B - 64 KB, Encoding: Binary / Text |

---

### Section 07 — Identity & Privacy (was: Concurrency Models)

| Element | Current (Template) | Proposed (111 Network) |
|---------|-------------------|------------------------|
| Number | `07` | `07` |
| Title | `Concurrency Models` | `Identity & Privacy` |
| Subtitle | `Parallel execution` | `You stay in control` |
| Description | `Managing simultaneous execution paths without chaos. Actor models, CSP channels, and lock-free data structures enable programs to harness multi-core architectures safely.` | `You don't need to sign up. Just open the app and go. Want to find friends later? Add an email or phone number anytime to reconnect. You stay in control of your identity and privacy.` |
| Thread Profiler label | `Thread Profiler` | `Privacy Status` |
| Time scale | `0ms — 100ms` | `Anonymous — Verified` |
| Thread names | main, worker-1, worker-2, io-pool, gc, scheduler | anonymous, email-linked, phone-linked, device-paired, bridge-user, verified |
| Legend labels | Working, Waiting, Blocked | Active, Dormant, Disabled |
| Channel Buffer label | `Channel Buffer` | `Identity Modes` |
| Buffer capacity | `128` | `Unlimited` (do not touch the changing number) |
| Specs | Model: CSP + Actor Hybrid, Threads: M:N Green Threads, Channels: Bounded MPMC, Scheduler: Work-Stealing | Signup: None Required, Identity: Self-Sovereign, Recovery: Email / Phone, Data: Zero Knowledge |

---

### Section 08 — Network Bridges (was: Hardware Abstraction)

| Element | Current (Template) | Proposed (111 Network) |
|---------|-------------------|------------------------|
| Number | `08` | `08` |
| Title | `Hardware Abstraction` | `Network Bridges` |
| Subtitle | `Interface layers` | `Connect the networks` |
| Description | `The invisible translators between software intent and hardware capability. HALs, device drivers, and firmware form the contract that makes portable computing possible.` | `Already on another trusted network? A small bridge lets you carry and receive 111 messages without leaving it. Two-way by design. Thin by design. Built into every device.` |
| Layer stack | L4 APPLICATION, L3 OS/RUNTIME, L2 HAL INTERFACE, L1 DRIVERS, L0 SILICON | L4 USER NETWORKS, L3 BRIDGE SHIM, L2 MESSAGE GATEWAY, L1 PROTOCOL ADAPTER, L0 111 CORE |
| Layer descriptions | User-facing software... / OS services... / Contract layer... / Device-specific modules... / Raw transistors... | Other mesh networks (Meshtastic, etc.) / Minimal translation layer / Message format converter / Protocol compatibility layer / 111 Network core protocol |
| CPU Registers label | `CPU Registers` | `Active Bridges` |
| Register names/values | RAX, RBX, RCX... with hex values | Bridge names with status (e.g., meshtastic-bridge / ACTIVE) |
| Specs | Interface: MMIO/PIO, Bus: PCIe Gen5 x16, DMA: IOMMU Protected, Firmware: UEFI 2.10 | Direction: Two-Way, Overhead: Minimal, Compatibility: Meshtastic / etc., Integration: Built-In |

---

## 5. Pseudo Terminal

| Command | Current Output | Proposed Output |
|---------|---------------|-----------------|
| `help` | Available commands list | Same structure, 111-themed commands |
| `sections` | 01 Kernel & Systems ... 08 Hardware Abstraction | 01 The Protocol ... 08 Network Bridges |
| `inspect` | Module: Monochrome ASCII Hub, Version: 1.0.0... | Module: 111 Network, Version: 0.0.5, Nodes: discovering, Encryption: enabled, Status: MESH ONLINE |
| `about` | Monochrome ASCII Hub v1.0.0... | **Uses README mission text:** `111 Network v0.0.5` + `A global message network that runs on people, not servers.` + `Works with phones, radios, satellites.` + `No company. No government. Just you.` |
| `stack` | Frontend: Next.js 16... | Protocol: 111 Mesh v0.0.5, Transport: Multi-channel, Encryption: End-to-end, Platform: Cross-platform, License: Open Source |
| `ascii` | MONOCHROME ASCII art | `111` ASCII art (TBD) |
| `v0` | `v0` ASCII art easter egg | Keep as-is or replace with 111-themed easter egg |
| `nodes` | N/A (new) | `Active nodes: 3 nearby, Last seen: 2s ago, Reachable: 1 via relay` |
| `status` | N/A (new) | `Mesh: ONLINE, Transports: 4 active, Messages queued: 0, Identity: anonymous` |
| Terminal header | `monochrome-hub ~ interactive` | `111-network ~ interactive` |
| Section title | `Terminal` | `Terminal` |
| Section description | `Explore the system. Type commands to interact with the ASCII Hub.` | `Explore the network. Type commands to check status and interact.` |

---

## 6. Footer

| Element | Current (Template) | Proposed (111 Network) |
|---------|-------------------|------------------------|
| ASCII logo | `MONOCHROME` ASCII art | `111` ASCII art (TBD) |
| Tagline | `A minimalist technical showcase built with precision. Pure monochrome. Pure code.` | `Free, Secure Communication for Everyone` |
| Connect heading | `Connect` | `Connect` |
| Social links | GitHub, Twitter, LinkedIn | GitHub only (for now) |
| Tech Stack heading | `Tech Stack` | `Built With` |
| Tech tags | Next.js, React, Tailwind, Framer Motion, Vercel | Next.js, React, TypeScript, Tailwind, Open Source |
| Copyright | `// Monochrome ASCII Hub — 2026` | `// 111 Network — 2026` |
| Bottom tagline | `Built with precision. Rendered in monochrome.` | `Built by people, not providers.` |

---

## 7. Open Questions / User Review Needed

### Specs for all 8 sections
Each section currently has 4 `label: value` spec pairs. Please provide 111 Network equivalents:

**01 The Protocol:**
- [ ] Spec 1 label + value:
- [ ] Spec 2 label + value:
- [ ] Spec 3 label + value:
- [ ] Spec 4 label + value:

**02 The Mesh:**
- [ ] Spec 1 label + value:
- [ ] Spec 2 label + value:
- [ ] Spec 3 label + value:
- [ ] Spec 4 label + value:

**03 Daily Shout:**
- [ ] Spec 1 label + value:
- [ ] Spec 2 label + value:
- [ ] Spec 3 label + value:
- [ ] Spec 4 label + value:

**04 Private Messages:**
- [ ] Spec 1 label + value:
- [ ] Spec 2 label + value:
- [ ] Spec 3 label + value:
- [ ] Spec 4 label + value:

**05 Offline Mode:**
- [ ] Spec 1 label + value:
- [ ] Spec 2 label + value:
- [ ] Spec 3 label + value:
- [ ] Spec 4 label + value:

**06 Multi-Transport:**
- [ ] Spec 1 label + value:
- [ ] Spec 2 label + value:
- [ ] Spec 3 label + value:
- [ ] Spec 4 label + value:

**07 Identity & Privacy:**
- [ ] Spec 1 label + value:
- [ ] Spec 2 label + value:
- [ ] Spec 3 label + value:
- [ ] Spec 4 label + value:

**08 Network Bridges:**
- [ ] Spec 1 label + value:
- [ ] Spec 2 label + value:
- [ ] Spec 3 label + value:
- [ ] Spec 4 label + value:

### Additional TBD
- [ ] **ASCII art** for each section — keep template art as placeholder or create 111-themed art?
- [ ] **Section 04 code examples** — what sample message content for the 5 pipeline stages?
- [ ] **v0 easter egg** — keep, remove, or replace?
- [ ] **Footer ASCII logo** — what should the 111 ASCII art look like?
- [ ] **GitHub URL** — what is the actual repo URL for the secondary CTA and footer link?

---

*Plan drafted: 2026-05-12*
*Next step: User reviews and fills in TBD items, then we execute the text replacement.*
