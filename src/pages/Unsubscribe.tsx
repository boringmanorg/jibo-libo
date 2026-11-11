import { memo } from "react";
import { MailX } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// XTSY sends no marketing email and keeps no subscriber list, so there is nothing to unsubscribe from.
const Unsubscribe = memo(() => (
  <>
    <Header />
    <main className="container mx-auto max-w-xl px-4 py-24 text-center">
      <MailX className="mx-auto mb-4 h-10 w-10 text-muted-foreground" aria-hidden />
      <h1 className="mb-3 text-2xl font-semibold text-foreground">No email list to leave</h1>
      <p className="text-muted-foreground">
        XTSY doesn't send marketing emails or keep a subscriber list. All booking conversations happen on WhatsApp at +91 8837317070.
      </p>
    </main>
    <Footer />
  </>
));
Unsubscribe.displayName = "Unsubscribe";
export default Unsubscribe;
