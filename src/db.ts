import { neon, NeonQueryFunction } from "@neondatabase/serverless";

export function getDb(env: Env): NeonQueryFunction<false, false> | null {
	const connectionString = env.DATABASE_URL;
	if (!connectionString) {
		return null;
	}
	return neon(connectionString);
}

/**
 * Otomatis membuat tabel jika belum ada di database Neon
 */
export async function initDbSchema(sql: NeonQueryFunction<false, false>) {
	await sql`
		CREATE TABLE IF NOT EXISTS orders (
			id VARCHAR(64) PRIMARY KEY,
			client_name VARCHAR(255) NOT NULL,
			client_email VARCHAR(255) NOT NULL,
			package_type VARCHAR(255) NOT NULL,
			fee_amount VARCHAR(64) NOT NULL,
			bug_description TEXT NOT NULL,
			repo_url VARCHAR(255) NOT NULL,
			branch_name VARCHAR(255) NOT NULL,
			status VARCHAR(64) NOT NULL,
			ai_stage VARCHAR(64),
			retention_expires VARCHAR(128),
			pr_url VARCHAR(255),
			zip_downloaded BOOLEAN DEFAULT FALSE,
			workspace_destroyed BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);
	`;

	await sql`
		CREATE TABLE IF NOT EXISTS jobs (
			id VARCHAR(64) PRIMARY KEY,
			order_id VARCHAR(64),
			repo VARCHAR(255) NOT NULL,
			branch VARCHAR(255) NOT NULL,
			title TEXT NOT NULL,
			agent VARCHAR(255) NOT NULL,
			status VARCHAR(64) NOT NULL,
			status_label VARCHAR(64) NOT NULL,
			time_label VARCHAR(64) NOT NULL,
			progress INT DEFAULT 0,
			logs JSONB DEFAULT '[]'::jsonb,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);
	`;

	await sql`
		CREATE TABLE IF NOT EXISTS agents (
			name VARCHAR(255) PRIMARY KEY,
			role TEXT NOT NULL,
			status VARCHAR(64) NOT NULL,
			active_jobs INT DEFAULT 0,
			efficiency VARCHAR(32) NOT NULL,
			avatar VARCHAR(16) NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);
	`;
}
