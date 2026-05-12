export interface TechSection {
  id: string
  number: string
  title: string
  subtitle: string
  description: string
  ascii: string
  specs: { label: string; value: string }[]
  commands: string[]
}

export const techSections: TechSection[] = [
  {
    id: "kernel-systems",
    number: "01",
    title: "The Protocol",
    subtitle: "Core mesh architecture",
    description:
      "The foundational layer where messages meet the mesh. Routing tables, store-and-forward buffers, and transport adapters form the backbone of every connection.",
    ascii: `
    ┌─────────────────────────┐
    │  KERNEL SPACE            │
    │  ┌───────┐ ┌───────┐   │
    │  │ SCHED │ │  MEM  │   │
    │  └───┬───┘ └───┬───┘   │
    │      │         │        │
    │  ┌───┴─────────┴───┐   │
    │  │   SYSTEM CALLS   │   │
    │  └─────────────────┘   │
    │  ┌───────────────────┐  │
    │  │   USER SPACE       │  │
    │  └───────────────────┘  │
    └─────────────────────────┘`,
    specs: [
      { label: "Routing", value: "Store & Forward" },
      { label: "Encryption", value: "End-to-End" },
      { label: "Transport", value: "Multi-Channel" },
      { label: "Range", value: "Device-to-Device" },
    ],
    commands: [
      "$ uname -a",
      "Linux monochrome 6.1.0 #1 SMP x86_64",
      "$ cat /proc/meminfo | head -3",
      "MemTotal:   16384000 kB",
      "MemFree:     8192000 kB",
      "MemAvailable: 12288000 kB",
    ],
  },
  {
    id: "network-topologies",
    number: "02",
    title: "The Mesh",
    subtitle: "Peer-to-peer connectivity",
    description:
      "Mapping the invisible web of people and devices that carry messages across the world. From phone to phone, radio to radio — every node strengthens the whole.",
    ascii: `
       [A]───────[B]
       /│\\         │\\
      / │ \\        │ \\
    [C] │ [D]──────[E] [F]
     \\  │ /        │  /
      \\ │/         │ /
       [G]───────[H]
        │           │
       [I]───────[J]`,
    specs: [
      { label: "Protocol", value: "111 Mesh v0.0.5" },
      { label: "Topology", value: "Hybrid Mesh" },
      { label: "Latency", value: "Variable (hops)" },
      { label: "Redundancy", value: "Path Diversity" },
    ],
    commands: [
      "$ traceroute node-alpha.mesh",
      "1  gateway (10.0.0.1)  0.5ms",
      "2  switch-core (10.0.1.1)  1.2ms",
      "3  node-alpha (10.0.2.42)  2.1ms",
      "$ netstat -an | wc -l",
      "2048 active connections",
    ],
  },
  {
    id: "distributed-ledger",
    number: "03",
    title: "Distributed Ledger",
    subtitle: "Network state layer",
    description:
      "The 111 Network uses a distributed ledger to anchor public messages, verify identity claims, and eventually secure the full message database. Trust is computed, not assumed. Every public shout is a signed entry. Every node validates.",
    ascii: `
    Block #1021        Block #1022
    ┌──────────┐      ┌──────────┐
    │ Hash: 0xA│─────>│ Hash: 0xB│
    │ Prev: 0x9│      │ Prev: 0xA│
    │ Nonce: 42│      │ Nonce: 87│
    │ Tx: 12   │      │ Tx: 8    │
    └──────────┘      └──────────┘
         │                  │
    ┌────┴────┐        ┌────┴────┐
    │ Merkle  │        │ Merkle  │
    │  Root   │        │  Root   │
    └─────────┘        └─────────┘`,
    specs: [
      { label: "Consensus", value: "Proof of Stake" },
      { label: "Block Time", value: "~12 seconds" },
      { label: "Hash Function", value: "SHA-256" },
      { label: "Finality", value: "2 epochs (~12.8 min)" },
    ],
    commands: [
      "$ ledger query --block latest",
      "Block #1022 | Hash: 0xB3F...A2",
      "$ ledger verify --merkle-root",
      "Root: 0x7D2...F1 [VALID]",
      "$ ledger peers --count",
      "Active Peers: 12,847",
    ],
  },
  {
    id: "compiler-design",
    number: "04",
    title: "Private Messages",
    subtitle: "End-to-end encryption",
    description:
      "Message people directly. Only you and the other person can read what's sent. No one else. Messages hop between nearby devices until they find a way to the intended user. The more users, the faster and wider the range.",
    ascii: `
    Source Code
        │
    ┌───▼───┐
    │ LEXER │ ──> Tokens
    └───┬───┘
    ┌───▼────┐
    │ PARSER │ ──> AST
    └───┬────┘
    ┌───▼──────────┐
    │ SEMANTIC     │
    │ ANALYSIS     │ ──> Typed AST
    └───┬──────────┘
    ┌───▼──────────┐
    │ CODE GEN     │ ──> IR / Binary
    └──────────────┘`,
    specs: [
      { label: "Encryption", value: "E2E (NaCl)" },
      { label: "Delivery", value: "Best Effort" },
      { label: "Max Size", value: "64 KB" },
      { label: "Expiry", value: "30 days" },
    ],
    commands: [
      "$ compile --emit-ast main.src",
      "AST: Program(FnDecl(main, Block(...)))",
      "$ compile --emit-ir main.src",
      "define i32 @main() { ret i32 0 }",
      "$ compile -O2 main.src -o main",
      "Compiled: 2.4KB binary [0 warnings]",
    ],
  },
  {
    id: "graphics-pipelines",
    number: "05",
    title: "Offline Mode",
    subtitle: "No internet required",
    description:
      "No bars? No Wi-Fi? No problem. Messages travel through phones, laptops, plug-in devices, even homemade tools. If someone nearby is connected, they help move messages for others too.",
    ascii: `
    Vertices ──> Vertex Shader
                     │
              Primitive Assembly
                     │
               Rasterization
                     │
              Fragment Shader
                     │
              ┌──────┴──────┐
              │  Framebuffer │
              │  ┌──┬──┬──┐ │
              │  │░░│▓▓│██│ │
              │  ├──┼──┼──┤ │
              │  │▓▓│░░│▓▓│ │
              │  └──┴──┴──┘ │
              └─────────────┘`,
    specs: [
      { label: "Storage", value: "Local Buffer" },
      { label: "Range", value: "100m - 10km" },
      { label: "Power", value: "Low Energy" },
      { label: "Fallback", value: "Any Transport" },
    ],
    commands: [
      "$ gpu-info --capabilities",
      "Compute Units: 80 | VRAM: 16GB",
      "$ render --scene cornell-box.gltf",
      "Triangles: 12,450 | FPS: 144",
      "$ shader compile fragment.glsl",
      "Fragment shader: 128 ALU ops",
    ],
  },
  {
    id: "logic-synthesis",
    number: "06",
    title: "Multi-Transport",
    subtitle: "Any way it can",
    description:
      "Messages are packed so they can travel via radios, phones, email, satellite tools. Smart routing picks the best path available. If one channel is down, the message finds another.",
    ascii: `
        A ──┐
            ├──[AND]──┐
        B ──┘         │
                      ├──[OR]── Q
        C ──┐         │
            ├──[AND]──┘
        D ──┘

    Truth Table:
    A B C D │ Q
    0 0 0 0 │ 0
    1 1 0 0 │ 1
    0 0 1 1 │ 1
    1 1 1 1 │ 1`,
    specs: [
      { label: "Channels", value: "Radio / Phone / Email / Satellite" },
      { label: "Fallback", value: "Auto-Switch" },
      { label: "Packet Size", value: "256 B - 64 KB" },
      { label: "Encoding", value: "Binary / Text" },
    ],
    commands: [
      "$ synth --target fpga design.sv",
      "LUTs: 4,200 | FFs: 1,800",
      "$ simulate --cycles 1000",
      "All assertions passed [1000/1000]",
      "$ timing-report --critical-path",
      "Slack: +0.3ns [TIMING MET]",
    ],
  },
  {
    id: "concurrency-models",
    number: "07",
    title: "Identity & Privacy",
    subtitle: "You stay in control",
    description:
      "You don't need to sign up. Just open the app and go. Want to find friends later? Add an email or phone number anytime to reconnect. You stay in control of your identity and privacy.",
    ascii: `
    Thread 1 ──┐         ┌── Thread 4
               │         │
    Thread 2 ──┼──[CH]──┼── Thread 5
               │    │    │
    Thread 3 ──┘    │    └── Thread 6
                    │
              ┌─────┴─────┐
              │  Channel   │
              │  Buffer    │
              │  [|||||||] │
              │  Cap: 128  │
              └───────────┘`,
    specs: [
      { label: "Signup", value: "None Required" },
      { label: "Identity", value: "Self-Sovereign" },
      { label: "Recovery", value: "Email / Phone" },
      { label: "Data", value: "Zero Knowledge" },
    ],
    commands: [
      "$ runtime --stats",
      "Goroutines: 14,200 | Threads: 8",
      "$ channel inspect --id main-ch",
      "Buffer: 42/128 | Blocked: 0",
      "$ deadlock-detect --scan",
      "No deadlocks detected [SAFE]",
    ],
  },
  {
    id: "hardware-abstraction",
    number: "08",
    title: "Network Bridges",
    subtitle: "Connect the networks",
    description:
      "Already on another trusted network? A small bridge lets you carry and receive 111 messages without leaving it. Two-way by design. Thin by design. Built into every device.",
    ascii: `
    ┌─────────────────────────┐
    │     APPLICATION          │
    ├─────────────────────────┤
    │     OS / RUNTIME         │
    ├─────────────────────────┤
    │     HAL INTERFACE        │
    │  ┌─────┐ ┌─────┐       │
    │  │ GPU │ │ NIC │ ...   │
    │  └──┬──┘ └──┬──┘       │
    ├─────┼───────┼───────────┤
    │     │  SILICON │         │
    │     └────┬────┘         │
    │        [HW]              │
    └─────────────────────────┘`,
    specs: [
      { label: "Direction", value: "Two-Way" },
      { label: "Overhead", value: "Minimal" },
      { label: "Compatibility", value: "Meshtastic / etc." },
      { label: "Integration", value: "Built-In" },
    ],
    commands: [
      "$ lspci -v | head -4",
      "00:02.0 VGA: Device [ACCEL]",
      "  Memory at 0xFE000000 (64-bit)",
      "$ hal query --device gpu0",
      "Status: ACTIVE | Driver: v12.1",
      "$ dmesg | grep firmware",
      "Firmware loaded: hal-core v3.2.1",
    ],
  },
]

export const navLinks = techSections.map((s) => ({
  id: s.id,
  number: s.number,
  title: s.title,
}))
