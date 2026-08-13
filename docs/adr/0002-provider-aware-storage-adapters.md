# Make Storage adapters Provider-aware

A Storage adapter identifies both its integration and concrete Provider/dialect
because an ORM name alone cannot promise equivalent transactions, identifiers,
JSON representation, indexes, or relation behavior. Each combination such as
Prisma MongoDB and Prisma PostgreSQL is a separate conformance target;
construction exposes or refuses lifecycle capabilities instead of silently
weakening guarantees.
