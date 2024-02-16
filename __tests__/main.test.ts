import io from "@actions/io";
import fs from "fs";
import os from "os";
import path from "path";
import { beforeAll, describe, expect, it, vi } from "vitest";

const toolDir = path.join(__dirname, "runner", "tools");
const tempDir = path.join(__dirname, "runner", "temp");

process.env.RUNNER_TOOL_CACHE = toolDir;
process.env.RUNNER_TEMP = tempDir;
process.env["INPUT_FAIL-FAST"] = "true";

import { getKustomize } from "../src/installer";

const IS_WINDOWS = os.platform() === "win32";

describe("installer tests", () => {
	beforeAll(async () => {
		await io.rmRF(toolDir);
		await io.rmRF(tempDir);
	});

	it("Acquires the max satisfying version range", async () => {
		await getKustomize("*");
		const kustomizeDir = path.join(toolDir, "kustomize", "*", os.arch());
		expect(fs.existsSync(`${kustomizeDir}.complete`)).toBe(true);

		if (IS_WINDOWS) {
			expect(fs.existsSync(path.join(kustomizeDir, "kustomize.exe"))).toBe(
				true,
			);
		} else {
			expect(fs.existsSync(path.join(kustomizeDir, "kustomize"))).toBe(true);
			expect(() =>
				fs.accessSync(path.join(kustomizeDir, "kustomize"), fs.constants.X_OK),
			).not.toThrow();
		}
	});

	it("Acquires kustomize version 5.2.1", async () => {
		await getKustomize("5.2.1");
		const kustomizeDir = path.join(toolDir, "kustomize", "5.2.1", os.arch());

		expect(fs.existsSync(`${kustomizeDir}.complete`)).toBe(true);

		if (IS_WINDOWS) {
			expect(fs.existsSync(path.join(kustomizeDir, "kustomize.exe"))).toBe(
				true,
			);
		} else {
			expect(fs.existsSync(path.join(kustomizeDir, "kustomize"))).toBe(true);
			expect(() =>
				fs.accessSync(path.join(kustomizeDir, "kustomize"), fs.constants.X_OK),
			).not.toThrow();
		}
	});

	it("Acquires kustomize version 3.2.0", async () => {
		await getKustomize("3.2.0");
		const kustomizeDir = path.join(toolDir, "kustomize", "3.2.0", os.arch());

		expect(fs.existsSync(`${kustomizeDir}.complete`)).toBe(true);

		if (IS_WINDOWS) {
			expect(fs.existsSync(path.join(kustomizeDir, "kustomize.exe"))).toBe(
				true,
			);
		} else {
			expect(fs.existsSync(path.join(kustomizeDir, "kustomize"))).toBe(true);
			expect(() =>
				fs.accessSync(path.join(kustomizeDir, "kustomize"), fs.constants.X_OK),
			).not.toThrow();
		}
	});

	it("Acquires kustomize version 3.2.1", async () => {
		await getKustomize("3.2.1");
		const kustomizeDir = path.join(toolDir, "kustomize", "3.2.1", os.arch());

		expect(fs.existsSync(`${kustomizeDir}.complete`)).toBe(true);

		if (IS_WINDOWS) {
			expect(fs.existsSync(path.join(kustomizeDir, "kustomize.exe"))).toBe(
				true,
			);
		} else {
			expect(fs.existsSync(path.join(kustomizeDir, "kustomize"))).toBe(true);
			expect(() =>
				fs.accessSync(path.join(kustomizeDir, "kustomize"), fs.constants.X_OK),
			).not.toThrow();
		}
	});

	it("Acquires kustomize version 3.3.0", async () => {
		await getKustomize("3.3.0");
		const kustomizeDir = path.join(toolDir, "kustomize", "3.3.0", os.arch());

		expect(fs.existsSync(`${kustomizeDir}.complete`)).toBe(true);

		if (IS_WINDOWS) {
			expect(fs.existsSync(path.join(kustomizeDir, "kustomize.exe"))).toBe(
				true,
			);
		} else {
			expect(fs.existsSync(path.join(kustomizeDir, "kustomize"))).toBe(true);
			expect(() =>
				fs.accessSync(path.join(kustomizeDir, "kustomize"), fs.constants.X_OK),
			).not.toThrow();
		}
	});

	it("Throws if no location contains correct kustomize version", async () => {
		let thrown = false;

		try {
			await getKustomize("1000");
		} catch {
			thrown = true;
		}

		expect(thrown).toBe(true);
	});

	it("Uses version of kustomize installed in cache", async () => {
		const kustomizeDir = path.join(toolDir, "kustomize", "3.2.0", os.arch());

		await io.mkdirP(kustomizeDir);

		fs.writeFileSync(`${kustomizeDir}.complete`, "hello");

		await getKustomize("3.2.0");

		return;
	});

	it("Resolves semantic versions of kustomize installed in cache", async () => {
		const kustomizeDir = path.join(toolDir, "kustomize", "3.0.0", os.arch());

		await io.mkdirP(kustomizeDir);

		fs.writeFileSync(`${kustomizeDir}.complete`, "hello");

		await getKustomize("3.0.0");
		await getKustomize("3.0");
	});
});
