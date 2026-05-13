import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { GlobalSetupContext } from "vitest/node";

let container: StartedPostgreSqlContainer;

export async function setup({ provide }: GlobalSetupContext) {
  container = await new PostgreSqlContainer("postgres:16")
    .withDatabase("testdb")
    .withUsername("test")
    .withPassword("test")
    .start();

  provide("postgresUri", container.getConnectionUri());
  provide("pgHost", container.getHost());
  provide("pgPort", container.getPort());
  provide("pgDatabase", container.getDatabase());
  provide("pgUser", container.getUsername());
  provide("pgPassword", container.getPassword());
}

export async function teardown() {
  await container?.stop();
}

declare module "vitest" {
  export interface ProvidedContext {
    postgresUri: string;
    pgHost: string;
    pgPort: number;
    pgDatabase: string;
    pgUser: string;
    pgPassword: string;
  }
}
