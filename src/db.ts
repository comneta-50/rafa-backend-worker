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
		CREATE TABLE IF NOT EXISTS users (
			id VARCHAR(64) PRIMARY KEY,
			email VARCHAR(255) UNIQUE NOT NULL,
			password_hash VARCHAR(255) NOT NULL,
			name VARCHAR(255) NOT NULL,
			role VARCHAR(64) DEFAULT 'developer',
			avatar VARCHAR(16) DEFAULT 'US',
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);
	`;

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

	await sql`
		CREATE TABLE IF NOT EXISTS reviews (
			id VARCHAR(64) PRIMARY KEY,
			title TEXT NOT NULL,
			repo VARCHAR(255) NOT NULL,
			branch VARCHAR(255) NOT NULL,
			author VARCHAR(255) NOT NULL,
			risk VARCHAR(64) NOT NULL,
			files_changed INT DEFAULT 1,
			additions INT DEFAULT 0,
			deletions INT DEFAULT 0,
			summary TEXT NOT NULL,
			time_label VARCHAR(64) NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);
	`;

	await sql`
		CREATE TABLE IF NOT EXISTS repos (
			name VARCHAR(255) PRIMARY KEY,
			description TEXT NOT NULL,
			stars INT DEFAULT 0,
			default_branch VARCHAR(64) DEFAULT 'main',
			synced_at VARCHAR(64) NOT NULL,
			status VARCHAR(64) NOT NULL,
			auto_fix BOOLEAN DEFAULT TRUE,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);
	`;

	await sql`
		CREATE TABLE IF NOT EXISTS settings (
			key VARCHAR(64) PRIMARY KEY,
			value JSONB NOT NULL,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);
	`;
}
