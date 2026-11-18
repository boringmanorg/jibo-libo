import { createFileRoute } from "@tanstack/react-router";
import GuwahatiToShillongTransport from "@/pages/GuwahatiToShillongTransport";
import { buildRouteHead } from "@/lib/seo-head";
import { TRANSPORT_REFERENCE, transportReferenceSchema } from '@/data/meghalayaTransportReference';

export const Route = createFileRoute("/travel-guide/guwahati-to-shillong-transport")({
  head: () =>
    buildRouteHead({
      path: TRANSPORT_REFERENCE.path,
      title: TRANSPORT_REFERENCE.title,
      description: TRANSPORT_REFERENCE.description,
      ogType: "article",
      jsonLd: transportReferenceSchema(),
    }),
  component: GuwahatiToShillongTransport,
});
