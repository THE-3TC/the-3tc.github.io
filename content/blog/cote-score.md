---
title: "Why your document parser's mAP is lying to you"
date: 2026-06-11
draft: false
author: ["Jonathan Bourne", "Mwiza Simbeye", "Ishtar Govia"]
description: "An interactive tour of the COTe score — why IoU, F1, and mAP mislead on documents, and what to measure instead."
tags: ["document-ai", "evaluation", "computer-vision"]
---

<link rel="stylesheet" href="/css/cote.css">

When using Document Layout Analysis (DLA) models, model performance is usually given as the mean Average Precision across the images in the test dataset. This value is somewhere between 0.0 and 1.0, with 1.0 being a perfect match with the ground truth.

But is a score of 0.9 good? What about 0.8, or 0.7? What if the **kind** of error being made impacts tasks being performed later in the pipeline? These questions are not something the mAP and its underlying metrics, the F1 and IoU (Intersection over Union), are able to answer. And start pointing to the more fundemental question "**What does good mean?**".

This is where the COTe score can help. The COTe score stands for Coverage, Overlap, Trespass and Excess. It is a decomposable metric that separates the different kinds of errors found in object detection, allowing practitioners to define "Good" in a way that is meaningful to them.

This guide provides a high-level introduction to COTe and how it differs from traditional object detection metrics, and is particularly useful for evaluating OCR and Document Understanding models.

## Traditional metrics

Pretty much all DLA models use a small tightly related set of metrics that have been inherited from the broader fields of computer vision and object detection:

- **IoU** (Intersection over Union) — how much a predicted box and a
  ground-truth box overlap, as a fraction of their combined area. 
- **F1** — A machine learning staple calculated using Recall (how many of the total were identified) and Precision (The fraction of true positives). In object detection this allows us to calulate how many objects in an image were correctly detected.
- **mAP** (mean Average Precision) — Typically used for an entire dataset, it is the area under the precision–recall curve, averaged across classes.

<figure class="cote-figure" style="max-width:680px">
  <div class="viz-sheet viz-sheet--tight">
  <svg class="viz-svg" viewBox="0 0 360 142" role="img"
       aria-label="Intersection over Union: a photograph of a beagle with a black ground-truth box and a blue dashed predicted box offset from it. The shaded overlap divided by the combined area gives IoU 0.46.">
    <defs>
      <pattern id="iou-hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
        <rect width="1.4" height="4" fill="#ffffff" opacity="0.55"/>
      </pattern>
      <clipPath id="iou-photo"><rect x="0" y="0" width="190" height="142" rx="2"/></clipPath>
    </defs>
    <image href="/images/iou-beagle.jpg" x="0" y="0" width="190" height="142" preserveAspectRatio="xMidYMid slice" clip-path="url(#iou-photo)"/>
    <rect x="86.0" y="78.0" width="34.0" height="49.0" fill="var(--cote-green)" fill-opacity="0.35"/>
    <rect x="86.0" y="78.0" width="34.0" height="49.0" fill="url(#iou-hatch)"/>
    <rect x="75.0" y="68.0" width="45.0" height="59.0" rx="1" fill="none" stroke="#111111" stroke-width="1.6"/>
    <rect x="86.0" y="78.0" width="45.0" height="59.0" rx="1" fill="none" stroke="var(--cote-blue)" stroke-width="1.6" stroke-dasharray="4 2.5"/>
    <rect x="75" y="59" width="46" height="8.5" rx="1" fill="#111111"/>
    <text x="78" y="65.4" font-size="6" fill="#ffffff">ground truth</text>
    <rect x="92" y="127.5" width="38" height="8.5" rx="1" fill="var(--cote-blue)"/>
    <text x="127" y="133.9" font-size="6" text-anchor="end" fill="#ffffff">prediction</text>
    <!-- the fraction: IoU = overlap / union -->
    <text x="224" y="68.5" font-size="10" text-anchor="end" fill="currentColor">IoU =</text>
    <rect x="234.0" y="24.1" width="11.7" height="15.3" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.6"/>
    <rect x="236.9" y="26.7" width="11.7" height="15.3" fill="none" stroke="var(--cote-blue)" stroke-width="0.8" stroke-dasharray="2 1.4" opacity="0.8"/>
    <rect x="236.9" y="26.7" width="8.8" height="12.7" fill="var(--cote-green)" fill-opacity="0.45"/>
    <text x="256" y="36" font-size="7.5" fill="currentColor" opacity="0.8">area of overlap</text>
    <line x1="230" y1="65" x2="352" y2="65" stroke="currentColor" stroke-width="0.8"/>
    <path d="M 234.0 88.0 h 11.7 v 15.3 h -11.7 Z M 236.9 90.6 h 11.7 v 15.3 h -11.7 Z" fill="var(--cote-green)" fill-opacity="0.45" fill-rule="nonzero"/>
    <rect x="234.0" y="88.0" width="11.7" height="15.3" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.6"/>
    <rect x="236.9" y="90.6" width="11.7" height="15.3" fill="none" stroke="var(--cote-blue)" stroke-width="0.8" stroke-dasharray="2 1.4" opacity="0.8"/>
    <text x="256" y="100" font-size="7.5" fill="currentColor" opacity="0.8">area of union</text>
    <text x="352" y="134" font-size="11" text-anchor="end" fill="currentColor">= 0.46</text>
  </svg>
  </div>
  <figcaption>Intersection over Union. The prediction (blue, dashed) sits a little low and to the right of the ground truth (black). IoU is the shaded overlap divided by the area the two boxes cover together: here 0.46, which already fails the usual 0.5 threshold. Photo: <a href="https://commons.wikimedia.org/wiki/File:Young_woman_jumping_with_her_lovely_beagle_dog_in_the_park_of_Bali_island,_Indonesia._(50194002498).jpg">Artem Beliaikin</a>, CC0, via Wikimedia Commons.</figcaption>
</figure>

These metrics dominate the fields of Object detection because they provide clear numeric values and are easy to calculate, leading them to be adopted by benchmarks and competitions such as PASCAL, VOC, and COCO, which led to the boom in performance and efficiency within object detection models that occurred in the 2010s.



## Photos aren't pages

IoU, F1, and mAP were built for **photographs**: 2D projections of a 3D world
where objects overlap and occlude each other. However, the written page is laid out to fit as much text as possible while still being readable. It's more similar to a 2D *tessellation*: text tiles the surface with no gaps, and where overlaps are impossible.

<div class="cote-widget">
  <div id="cote-odvspage"></div>
</div>

This is where the COTe score differs: instead of IoU, which uses only spatial information, it uses a concept called the Structural Semantic Unit (SSU), which combines spatial and Semantic information. This means that two separate boxes containing text may be part of the same SSU because they can logically be combined, for example, two adjacent paragraphs of text.

## The granularity trap and the ability to represent reality

A major problem with the current crop of IoU-based approaches is the need to set an IoU threshold. If the IoU does not reach the threshold, the score is effectively 0, whilst if it is above it is 1. This binary way of thinking about prediction can lead to some pretty strange situations, as shown in the example below. 

The example shows two sets of boxes outlining a page of text: on the left is the ground truth broken across 3 boxes, which make up a single SSU, and on the right is the model predictions where the number of predicted boxes can be varied. As can be seen, the union/sum of the outlines of the predictions covers exactly the same area as the union/sum of the ground truth. 

In all cases the parse is perfect only the granularity changes. Flip between **coarser**, **aligned**, and **finer**, to see what happens.

<div class="cote-widget">
  <div id="cote-granularity"></div>
</div>

The example shows that the F1 goes to zero when the predictions are either 1 or 9 boxes relative to the ground truth's 3. This is because the IoU is less than 0.5; in contrast, the COTe score stays at 1 throughout. This is because F1 pairs boxes one-to-one by overlap, so it scores well only when the model's granularity matches (or is close to) the ground truth label granularity.

When the granularity diverges from the ground truth, the F1 can collapse even if the model has performed well. This is called **Pragmatic Failure** as the evaluation metric fails to understand the model data relationship. The COTe score suceed because it has more **Pragmatic Competance** or ability to interpret the results.

## Beyond high and low scores: analysing decomposed scores 

Beyond its use of the SSU, which gives the COTe score its granularity robustness the COTe score can be decomposed into 4 sub-scores which is measured against the area of the ground-truth content:

- **Coverage** — how much of the content got predicted at all.
- **Overlap** — content covered by *more than one* box.
- **Trespass** — a box bleeding into a *different* semantic unit, merging
  unrelated text.
- **Excess** — predicted area landing in the margins, outside any content, this is used as a support metric for additional context.

The total COTe score is simply:

$$\text{COTe} = \mathcal{C} - \mathcal{O} - \mathcal{T}$$

A perfect parse is `1.0` and occurs when Coverage is maximised at `1.0` whilst Overlap and Trespass are both `0.0`. Really poor parsing can even result in negative COTe scores!

Using the example below, click off/on the predictions and drag them about to see how this affects the COTe score and its decomposition.

<div class="cote-widget">
  <p class="cote-widget__title">Drag the boxes. Toggle them. Watch the score.</p>
  <div id="cote-overlay"></div>
</div>

In the example, there are three SSU ground-truth blocks shown by the blocks of grey lines. Predictions are assigned to an SSU based on the total fraction of the predicted box. As you move a prediction across the page, you can see that the areas of Coverage and Trespass suddenly flip, this is when the assigned SSU has changed.

The below image shows some text with the SSU of the limericks highlighted. The 1st and 3rd limericks both have two SSU the title and the body text, whilst the second SSU is broken across two columns and resulting in three SSU.

<figure class="cote-figure">
  <img src="/images/example_ssu.png" alt="A two-column page of three limericks, each split into Structural Semantic Units outlined in red, blue, and green.">
  <figcaption>The same page, divided into Structural Semantic Units (SSU 1, 2, 3) across two columns.</figcaption>
</figure>

The image below shows how the COTe score would be built up for a set of predictions over the three limericks. 

<figure class="cote-figure">
  <img src="/images/example_cote_components.png" alt="The limerick page shaded by COTe component: green coverage, yellow overlap, red trespass, purple overlap-plus-trespass, blue excess.">
  <figcaption>COTe components on a real page — the same colour language as the interactive.</figcaption>
</figure>

## Real models, real failures

In the image below and the following bar chart, we compare three different real DLA models and their ability to parse a real archival newspaper page. It's clear that there can have very big overall performance differences between models and that the way the models fail can be very different even when overall performance is similar.

<figure class="cote-figure">
  <img src="/images/TTW_1868-05-16_page_5.png" alt="One 1868 newspaper page parsed by three models — YOLO, Heron, and PP-DocLayout-L — each shaded by COTe component. YOLO is heavily red and yellow; Heron and PP-DocLayout are mostly green.">
  <figcaption>One page, three models. YOLO (left) Performs very badly with massive amounts of Overlap and Trespass; Heron (centre) and PP-DocLayout-L (right) both perform pretty well with no Trespass.</figcaption>
</figure>

<div class="cote-widget" id="cote-failuremodes">
  <p class="cote-widget__title">One page, three models, three very different parses</p>
  <div class="viz-sheet viz-sheet--tight viz-static">
  <svg class="viz-svg" viewBox="0 0 320 170" role="img"
       aria-label="COTe scores on one newspaper page: DocLayout-YOLO minus 0.55, Heron 0.66, PP-DocLayout-L 0.65">
    <defs>
      <pattern id="fm-hatch" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
        <rect width="1.6" height="5" fill="rgba(255,255,255,0.55)"/>
      </pattern>
    </defs>
    <line x1="34" y1="30"  x2="300" y2="30"  stroke="currentColor" stroke-opacity="0.12"/>
    <line x1="34" y1="100" x2="300" y2="100" stroke="currentColor" stroke-opacity="0.35"/>
    <line x1="34" y1="150" x2="300" y2="150" stroke="currentColor" stroke-opacity="0.12"/>
    <text x="28" y="33"  font-size="7.5" text-anchor="end" fill="currentColor" opacity="0.55">1</text>
    <text x="28" y="103" font-size="7.5" text-anchor="end" fill="currentColor" opacity="0.55">0</text>
    <text x="28" y="153" font-size="7.5" text-anchor="end" fill="currentColor" opacity="0.55">−0.5</text>
    <!-- YOLO: −0.55 -->
    <path d="M 72 100 H 108 V 152 Q 108 155 105 155 H 75 Q 72 155 72 152 Z" fill="var(--cote-red)"/>
    <path d="M 72 100 H 108 V 152 Q 108 155 105 155 H 75 Q 72 155 72 152 Z" fill="url(#fm-hatch)"/>
    <text x="90" y="166" font-size="8.5" text-anchor="middle" fill="currentColor">DocLayout-YOLO</text>
    <text x="90" y="95"  font-size="9"   text-anchor="middle" fill="currentColor">−0.55</text>
    <!-- Heron: 0.66 -->
    <path d="M 152 100 V 57 Q 152 54 155 54 H 185 Q 188 54 188 57 V 100 Z" fill="var(--cote-green)"/>
    <text x="170" y="166" font-size="8.5" text-anchor="middle" fill="currentColor">Heron</text>
    <text x="170" y="49"  font-size="9"   text-anchor="middle" fill="currentColor">0.66</text>
    <!-- PP-DocLayout-L: 0.65 -->
    <path d="M 232 100 V 58 Q 232 55 235 55 H 265 Q 268 55 268 58 V 100 Z" fill="var(--cote-green)"/>
    <text x="250" y="166" font-size="8.5" text-anchor="middle" fill="currentColor">PP-DocLayout-L</text>
    <text x="250" y="50"  font-size="9"   text-anchor="middle" fill="currentColor">0.65</text>
  </svg>
  </div>
  <p class="viz-caption">COTe on the same 1868 page. A negative score means the parse did more harm than predicting nothing: YOLO covers almost everything but smears boxes across columns.</p>
</div>

DocLayout-YOLO covers almost everything (Coverage 0.98) but smears boxes across
column boundaries (Trespass 0.99, Overlap 0.54), resulting in a **COTe −0.55**,
worse than predicting nothing. Heron and PP-DocLayout have no Trespass but have less coverage, scoring around **0.65**. IoU and F1 rate all three as
mediocre and don't identify the differences, making model selection or mitigation strategies difficult.

## Use it

The COTe score is available as part of a pip-installable Python library:

```bash
pip install cotescore
```
The library contains all the tools necessary for a COTe analysis of a dataset, including visualisations, and can easily be built into any DLA workflow.
Although ideally the data is labelled with SSU (An ALTO auto-labeller is included in the library), it is often not necessary to get most of COTe's robustness benefits.

The full method is available in the paper:
[arXiv:2603.12718](https://arxiv.org/abs/2603.12718) ·
[code](https://github.com/THE-3TC/cotescore).

<script src="https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js"></script>
<script type="module" src="/js/cote/cote-post.mjs"></script>
