import React from "react";
import ReactDOM from "react-dom/client";
import { PreviewGallery } from "./preview/PreviewGallery";
import "./preview/preview.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PreviewGallery />
  </React.StrictMode>,
);
