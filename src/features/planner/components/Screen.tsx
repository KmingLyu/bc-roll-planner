import { useEffect, useRef, useState } from "react";
import { Header } from "@/app/Header";
import { Footer } from "@/app/Footer";
import { cn } from "@/lib/utils";
import { usePlannerScreen } from "../PlannerPageContainer";
import { Overlay } from "./Overlay";
import { InputStage } from "./InputStage";
import { ResultsStage } from "./ResultsStage";
import { ScrollTopButton } from "./ScrollTopButton";

export function Screen() {
  const { session, appliedSession, runOverlayOpen, cancelPlannerFlow } =
    usePlannerScreen();
  const topRef = useRef<HTMLDivElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const isResultsStage = session.stage === "results" && !!appliedSession;
  const shouldRestoreInputView = session.stage === "input" && !!appliedSession;

  useEffect(() => {
    if (!isResultsStage) return;

    topRef.current?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }, [isResultsStage]);

  useEffect(() => {
    if (!shouldRestoreInputView) return;

    topRef.current?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }, [shouldRestoreInputView]);

  useEffect(() => {
    if (!runOverlayOpen) return;

    const { body, documentElement } = document;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = documentElement.style.overflow;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    return () => {
      body.style.overflow = prevBodyOverflow;
      documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [runOverlayOpen]);

  useEffect(() => {
    if (!isResultsStage) return;

    const onScroll = () => {
      setShowScrollTop(window.scrollY > 140);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isResultsStage]);

  return (
    <>
      <div
        className={cn(
          "mx-auto w-full space-y-4",
          isResultsStage ? "max-w-[1480px]" : "max-w-[1220px]",
        )}
      >
        <div ref={topRef} />
        <Header />
        {isResultsStage ? <ResultsStage /> : <InputStage />}
        <Footer />
      </div>
      <ScrollTopButton
        visible={isResultsStage && showScrollTop}
        onClick={() =>
          topRef.current?.scrollIntoView({
            block: "start",
            behavior: "smooth",
          })
        }
      />
      <Overlay open={runOverlayOpen} onCancel={cancelPlannerFlow} />
    </>
  );
}
