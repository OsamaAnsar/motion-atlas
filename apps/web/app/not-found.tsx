import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/primitives";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-center gap-4 py-24 text-center">
      <span className="metric text-4xl text-muted">404</span>
      <h1 className="text-xl font-semibold">This route isn&rsquo;t on the map</h1>
      <p className="text-sm text-muted">The page you&rsquo;re looking for doesn&rsquo;t exist.</p>
      <Button asChild variant="secondary">
        <Link href="/">Back to Motion Atlas</Link>
      </Button>
    </Container>
  );
}
