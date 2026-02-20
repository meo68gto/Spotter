# Research Memo: Vector Similarity Feasibility

## Options
- pgvector in Postgres
- Pinecone managed vector database

## Recommendation
Start with pgvector in the primary Postgres instance.

## Rationale
- Lower operational complexity and lower integration cost.
- Keeps transactional + semantic candidate features co-located.
- Enables fast experimentation with embedding strategies before scale split.

## Exit Criteria for Pinecone
- Vector workload meaningfully degrades OLTP performance.
- Need high-throughput ANN tuning beyond acceptable Postgres operational overhead.
