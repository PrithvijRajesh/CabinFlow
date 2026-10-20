# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Name

CabinFlow

## Project Description

A application that connects to seat back screens to help improve airline operations. Users can request a spot in the bathroom line, make snack service requests, request assitance, and look at flight information. Cabin crew can use to manage user requests, understand snack preferences, and manage cabin movement. Sold to seatback IFE manufacturers (e.g. Panasonic Avionics) as a module on their platform.

## Stack

- React 19 + TypeScript, built with Vite
- Frontend only for now; a backend or real-time service will be proposed when shared state is needed
- Run: `npm install`, then `npm run dev`. Check: `npm run build` and `npm run lint` (oxlint)


## Rules

1. I have technical background so you can explain everything with technical terms but do not be too technical
2. I prefer shorter and more concise explanations and instructions 
3. Do not move from the working project directory and ask for permissions and give an explanation for why you need to move
4. Stay within the project scope that is decribed in the prd.md 
5. Read the prd.md to understand the project and scope of the project
6. Focus on one feature at a time, just focus on the item that is current focus
7. Before adding a service confirm with me and explain why it is needed
8. Create 2 md files if they do not exist yet, one called WorkLog and one called FeatureAnalysis, after each feature is implemented you will add to each md file, the WorkLog will just go over when the feature was completed and updated as feature milestones are completed saying what the milestone was, the FeatureAnalysis will explain the feature so I understand how it was implemented and why it is important.
9. Read NOTES.md at the start of each session and update it after each feature.

## Current Focus

Crew assistance requests: see incoming requests (urgent first), mark On my way and Done (PRD Feature 8).
