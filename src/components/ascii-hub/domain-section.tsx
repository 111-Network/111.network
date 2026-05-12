"use client"

import type { TechSection } from "@/lib/sections-data"
import { SectionProtocol } from "./sections/section-protocol"
import { SectionMesh } from "./sections/section-mesh"
import { SectionLedger } from "./sections/section-ledger"
import { SectionMessages } from "./sections/section-messages"
import { SectionOffline } from "./sections/section-offline"
import { SectionTransport } from "./sections/section-transport"
import { SectionIdentity } from "./sections/section-identity"
import { SectionBridges } from "./sections/section-bridges"

interface DomainSectionProps {
  section: TechSection
  index: number
}

const sectionMap: Record<string, React.FC<{ section: TechSection }>> = {
  "the-protocol": SectionProtocol,
  "the-mesh": SectionMesh,
  "distributed-ledger": SectionLedger,
  "private-messages": SectionMessages,
  "offline-mode": SectionOffline,
  "multi-transport": SectionTransport,
  "identity-privacy": SectionIdentity,
  "network-bridges": SectionBridges,
}

export function DomainSection({ section }: DomainSectionProps) {
  const SectionComponent = sectionMap[section.id] ?? SectionProtocol

  return (
    <section id={section.id} className="relative border-b border-border">
      <SectionComponent section={section} />
    </section>
  )
}
