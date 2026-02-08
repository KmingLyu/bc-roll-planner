// src/pages/HomePage.tsx
import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Link,
  Stack,
  Typography,
} from "@mui/material";

import PlannerPage from "@/pages/PlannerPage";
import { DATA_SOURCES } from "@/shared/config/dataSources";
import { DataSourceDisclaimerNote } from "@/shared/ui/DataSourceDisclaimerNote";

export default function HomePage() {
  return <PlannerPage />;
}
