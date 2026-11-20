-- Runs once when the local container is first created: a separate database for integration tests,
-- so test runs never touch development data.
CREATE DATABASE tablequeue_test OWNER tablequeue;
