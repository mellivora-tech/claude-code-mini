#!/usr/bin/env bun
import { Bootstrap } from "./bootstrap"

if (import.meta.main) {
  await new Bootstrap().run()
}

export { Bootstrap }
