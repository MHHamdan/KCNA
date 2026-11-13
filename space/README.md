---
title: KCNA Interactive Learning Lab
emoji: ☸️
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: true
short_description: Learn, practice and prepare for the CNCF KCNA exam
models:
  - Qwen/Qwen3-4B-Instruct-2507
  - unsloth/Qwen3-4B-Instruct-2507-GGUF
---

# KCNA Interactive Learning Lab

Interactive Kubernetes and Cloud Native Associate (KCNA) study platform with a grounded AI tutor.

**This Space is deployed automatically from GitHub — do not edit files here.**
Source, docs and issue tracker: https://github.com/MHHamdan/KCNA

- Runs on free CPU hardware. The AI tutor uses an open-weight model through llama.cpp inside this container: no paid inference, no API keys.
- Free Spaces sleep when idle; the first visit after a pause takes a minute or two to wake up.
- Progress is stored in your browser only. Use *Progress & settings → Export* to back it up.
- All practice questions are original and unofficial. Not affiliated with CNCF or the Linux Foundation.
