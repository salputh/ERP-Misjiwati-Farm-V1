# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Laravel 13 + Livewire 4 + Alpine.js (bundled with Livewire). UI uses the HexaDash template (Bootstrap 5, jQuery, Chart.js) from `public/assets`. All template pages and widgets are kept in `resources/views/template/` as a reference catalogue, browsable at `/template` in local development. SQLite for now.

## Users

Primary: the farm owner / manager, who uses the ERP to oversee the farm's operations. Used on laptop, iPad, and phone, so every screen must work across those three sizes. Other roles (field staff, warehouse, finance) are not yet confirmed.

## Product Purpose

An internal ERP for Misjiwati Farm, a livestock farm (peternakan). Species are not yet specified (chicken, cattle, goats, etc.). It gives the owner/manager one place to run and monitor the farm.

## Operating Context

Single farm, single location. No multi-branch requirement. The interface is in Indonesian (locale `id`, timezone Asia/Jakarta).

## Capabilities and Constraints

- Livestock farming is the confirmed domain. Priority modules beyond that are undecided.
- Responsive across laptop, iPad, and phone.
- Single-location, so no multi-branch or multi-tenant model for now.
- Undecided: species handled, module list and priority, roles and permissions, authentication.

## Evidence on Hand

None beyond the scaffold. No real data, logos, brand assets, or sample records exist yet; future work must not fabricate them.

## Product Principles

- Owner-first: the manager's overview of the whole farm comes before any single-task screen.
- Device-agnostic: laptop, iPad, and phone are equal targets, not desktop plus a shrunk mobile view.
- Local by default: Indonesian language, Rupiah, and local date formats.
- Start simple: one farm, one location; add complexity only when a real need is confirmed.
