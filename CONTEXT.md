# pagebldr

The shared language for an embeddable visual page-building engine and the hosts
that integrate it.

## Language

**Host**: A React application that embeds `pagebldr` and owns product policy,
persistence, publication, resources, permissions, and surrounding screens.
_Avoid_: CMS, tenant

**Reference Host**: The repository's runnable example application that consumes
the packed public package exactly as an external developer would. It is the
canonical visual and interaction acceptance surface for the Default experience,
not sample code or a disposable demo. _Avoid_: Playground, showcase

**Default experience**: The complete, package-owned and pre-styled editor,
renderer, standard Elements, Blocks, Templates, controls and tools available
immediately after installation and the documented minimal Host wiring. A Host
may theme or extend it but does not assemble or redesign it. _Avoid_: Starter
UI, headless editor

**Builder configuration**: An immutable, application-level description of a
builder namespace, definitions, contributions, presets, and resource adapters.
_Avoid_: Global config, options bag

**Document**: A portable, schema-versioned page value containing a normalized
element tree, reusable classes, design variables, and document settings.
_Avoid_: Page record, revision, publication

**Element**: An individually addressable node in a Document's editable tree,
with a registered type, version, properties, children, and styles. _Avoid_:
Component, widget, block

**Element definition**: The complete registered contract for one Element type:
validation, defaults, child policy, migrations, controls, rendering, style
capabilities, accessibility, and reference extraction. _Avoid_: Element config,
renderer entry

**Block**: A reusable factory that inserts an ordinary editable Element subtree.
_Avoid_: Widget, opaque renderer

**Template**: A factory for creating a complete Document or a substantial
starting composition from ordinary Elements. _Avoid_: Theme, saved page

**Control**: An editor contribution that edits a typed portion of an Element's
properties or styles. _Avoid_: Field component

**Style capability**: A named, stable group of style properties that an Element
definition permits the editor to expose. _Avoid_: CSS override

**Resource**: A host-owned value referenced by a Document through a typed
reference, such as an asset or application link target. _Avoid_: Quiz, media row

**Resource adapter**: A Host implementation that browses, creates, resolves, and
optionally inspects one Resource kind. _Avoid_: Database adapter, provider

**Destination**: A typed Element-owned navigation intent: external URL, anchor,
email, telephone, or Host application Resource. Destinations are validated in
the Document and resolved only at the Host/runtime seam. _Avoid_: Raw href, Quiz
link

**Storage adapter**: A server-side implementation that persists Documents and
Revisions using a declared database integration and Provider while satisfying
the package's storage contract. _Avoid_: Resource adapter, database provider

**Provider**: The concrete database or dialect used beneath a Storage adapter,
such as MongoDB or PostgreSQL beneath Prisma. _Avoid_: Adapter, ORM

**Collection policy**: The server configuration that permits one named Document
or multiple Documents over the same storage model. _Avoid_: Tenant mode,
database mode

**Audit event**: A durable, append-only record of an editor or server action
against a Document, attributed to a Host-supplied Actor and Scope. _Avoid_:
Console log, analytics event

**Analytics event**: A consent-aware observation of published-page usage, such
as a Visit or an Interaction, without authoring-state semantics. _Avoid_: Audit
event, server log

**Event sink**: A Host-configured destination that accepts schema-versioned
Audit or Analytics events and makes them available to the Host's chosen storage
or observability system. _Avoid_: Logger, analytics provider

**Published page**: A route-resolvable runtime value containing a published
Document, prepared Resources, metadata, and publication identity. _Avoid_:
Draft, editor preview

**Runtime**: The package module that resolves a route to a Published page,
prepares it for rendering, and emits public Analytics events through a Host
Event sink. _Avoid_: Renderer, router

**Local history**: Ephemeral undo and redo state owned by the editor session.
_Avoid_: Revision history, version history

**Revision**: A durable Host-owned snapshot or change record. _Avoid_: Undo
step, Document version

**Publication**: A Host-owned decision that makes a Document or Revision
available to an audience. _Avoid_: Save, render

**Slot**: A stable, typed location in the editor shell where Contributions are
arranged. _Avoid_: Override point, portal

**Contribution**: A registered panel, tab, toolbar action, or other editor-shell
item placed into a compatible Slot. _Avoid_: Plugin, arbitrary child

**Preset**: A named arrangement of Slots and Contributions for the editor shell.
_Avoid_: Theme, layout blob
