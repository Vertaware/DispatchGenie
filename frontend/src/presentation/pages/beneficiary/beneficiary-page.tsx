"use client";

import { useState } from "react";
import BeneficiaryContainer from "./components/beneficiary-container";
import Header from "./header";

export default function BeneficiaryPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleBeneficiaryCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <>
      <Header onBeneficiaryCreated={handleBeneficiaryCreated} />
      <BeneficiaryContainer key={refreshTrigger} />
    </>
  );
}
