import React from "react";
import { Composition } from "remotion";
import ProjectMotionVideo from "./generated-project";
import { settings, theme } from "./export-settings";

export function Root() {
  return <Composition id="ProjectExport" component={ProjectMotionVideo} {...settings} defaultProps={{ theme }} />;
}
