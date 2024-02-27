import { GitHub, getOctokitOptions } from "@actions/github/lib/utils";
import type { OctokitOptions } from "@octokit/core/dist-types/types.d";
import { throttling } from "@octokit/plugin-throttling";
import { warning, getInput, getBooleanInput, addPath } from "@actions/core";
import { downloadTool, extractTar, cacheFile, find } from "@actions/tool-cache";
import { join } from "node:path";
import { validRange, valid, maxSatisfying, gt } from "semver";
import { chmodSync } from "node:fs";
let tempDirectory = process.env.RUNNER_TEMPDIRECTORY ?? "";

const EnhancedOctokit = GitHub.plugin(throttling);

const githubToken = getInput("github-token");
const failFast = getBooleanInput("fail-fast", { required: false });

let options: OctokitOptions = {
	throttle: {
		onRateLimit: (retryAfter: number, opts: OctokitOptions) => {
			warning(`Request quota exhausted for request ${opts.method} ${opts.url}`);
			if (!failFast) {
				warning(`Retrying after ${retryAfter} seconds!`);
			}
			return !failFast;
		},
		onSecondaryRateLimit: (retryAfter: number, opts: OctokitOptions) => {
			warning(`Abuse detected for request ${opts.method} ${opts.url}`);
			if (!failFast) {
				warning(`Retrying after ${retryAfter} seconds!`);
			}
			return !failFast;
		},
	},
};

if (process.env.NODE_ENV === "test") {
	options = githubToken ? getOctokitOptions(githubToken, options) : options;
} else {
	options = getOctokitOptions(githubToken, options);
}

const octokit = new EnhancedOctokit(options);
const versionRegex = /\d+\.?\d*\.?\d*/;
const toolName = "kustomize";
const platform = process.platform;
const arch = process.arch === "x64" ? "amd64" : process.arch;

if (!tempDirectory) {
	let baseLocation: string | null = null;
	if (process.platform === "win32") {
		// On windows use the USERPROFILE env variable
		baseLocation = process.env.USERPROFILE || "C:\\";
	} else {
		if (process.platform === "darwin") {
			baseLocation = "/Users";
		} else {
			baseLocation = "/home";
		}
	}
	tempDirectory = join(baseLocation, "actions", "temp");
}

export async function getKustomize(targetVersion: string): Promise<void> {
	if (!validRange(targetVersion))
		throw new Error(`invalid semver requested: ${targetVersion}`);

	const resolver = valid(targetVersion)
		? getPinnedVersion
		: getMaxSatisfyingVersion;

	let kustomizePath = find("kustomize", targetVersion);

	if (!kustomizePath) {
		const version = await resolver(targetVersion);
		kustomizePath = await acquireVersion(version);
	}

	return addPath(kustomizePath);
}

interface Version {
	resolved: string;
	target: string;
	url: string;
}

async function getPinnedVersion(targetVersion: string): Promise<Version> {
	const prefix = gt(targetVersion, "3.2.0") ? "kustomize/v" : "v";

	try {
		const response = await octokit.rest.repos.getReleaseByTag({
			owner: "kubernetes-sigs",
			repo: "kustomize",
			tag: prefix + targetVersion,
		});

		if (response.status !== 200) {
			throw new Error(`Invalid response status ${response.status}`);
		}

		const release = response.data;

		const matchingAsset = release.assets.find(
			(asset) =>
				asset.name.includes("kustomize") &&
				asset.name.includes(platform) &&
				asset.name.includes(arch),
		);

		if (matchingAsset) {
			const kustomizeVersion = (
				versionRegex.exec(release.tag_name) || []
			).shift();

			if (kustomizeVersion != null) {
				return {
					target: targetVersion,
					resolved: kustomizeVersion,
					url: matchingAsset.browser_download_url,
				};
			}
			throw new Error(
				`Could not find version in release tag ${release.tag_name}`,
			);
		}
		throw new Error(
			`Could not find asset for platform '${platform}' and '${arch}'.`,
		);
	} catch (err) {
		throw new Error(`Could not satisfy version range ${targetVersion}: ${err}`);
	}
}

async function getMaxSatisfyingVersion(
	targetVersion: string,
): Promise<Version> {
	const version = { target: targetVersion };
	const availableVersions: Map<string, string> = new Map();

	for await (const response of octokit.paginate.iterator(
		octokit.rest.repos.listReleases,
		{
			owner: "kubernetes-sigs",
			repo: "kustomize",
			per_page: 100,
		},
	)) {
		for (const release of response.data) {
			const matchingAsset = release.assets.find(
				(asset) =>
					asset.name.includes("kustomize") &&
					asset.name.includes(platform) &&
					asset.name.includes(arch),
			);

			if (matchingAsset) {
				const kustomizeVersion = (
					versionRegex.exec(release.tag_name) || []
				).shift();

				if (kustomizeVersion != null) {
					availableVersions.set(
						kustomizeVersion,
						matchingAsset.browser_download_url,
					);
				}
			}
		}
	}

	const resolved = maxSatisfying([...availableVersions.keys()], version.target);

	if (!resolved) {
		throw new Error(
			`Could not satisfy version '${version.target}': Could not find asset for platform '${platform}' and
      ${arch}'.`,
		);
	}

	const url = availableVersions.get(resolved) as string;

	return { ...version, resolved, url };
}

async function acquireVersion(version: Version): Promise<string> {
	const toolFilename =
		process.platform === "win32" ? `${toolName}.exe` : toolName;
	let toolPath: string;

	try {
		toolPath = await downloadTool(version.url);
	} catch (err) {
		throw new Error(`Failed to download version ${version.target}: ${err}`);
	}

	if (version.url.endsWith(".tar.gz")) {
		toolPath = await extractTar(toolPath);
		toolPath = join(toolPath, toolFilename);
	}

	switch (process.platform) {
		case "linux":
		case "darwin":
			chmodSync(toolPath, 0o755);
			break;
	}

	return await cacheFile(toolPath, toolFilename, toolName, version.target);
}
