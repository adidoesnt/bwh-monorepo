<script lang="ts">
	import { ledgerLabel } from '$lib/activity';
	import BuyPackageModal from '$lib/components/BuyPackageModal.svelte';
	import { longDateNoYear, relativeDay } from '$lib/format';
	import { browserZone } from '$lib/tz';
	import type { PurchasablePackage } from '$lib/server/queries';
	import { untrack } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const tz = untrack(() => data.user.timezone ?? browserZone());
	const today = new Date();
	const sgd = (cents: number) => `SG$${Math.round(cents / 100)}`;
	const firstOf = (name: string) => name.split(' ')[0] ?? name;

	const packages = $derived(data.packages);
	const pending = $derived(data.pending);

	// catalogue grouped by coach for "get more sessions"
	const byCoach = $derived.by(() => {
		const groups = new Map<string, { coachName: string; coachSlug: string; items: PurchasablePackage[] }>();
		for (const p of data.catalogue) {
			const g = groups.get(p.coachSlug) ?? { coachName: p.coachName, coachSlug: p.coachSlug, items: [] };
			g.items.push(p);
			groups.set(p.coachSlug, g);
		}
		return [...groups.values()];
	});

	const pct = (left: number, granted: number) =>
		granted > 0 ? Math.round((Math.max(0, left) / granted) * 100) : 0;
	const barClass = (p: number) => (p > 50 ? 'bg-success' : p > 20 ? 'bg-warning' : 'bg-error');

	let buyTarget = $state<PurchasablePackage | null>(null);
	let buyOpen = $state(false);
	function buy(p: PurchasablePackage) {
		buyTarget = p;
		buyOpen = true;
	}
</script>

<div class="mx-auto max-w-4xl p-6 md:p-10">
	<h1 class="font-headings mb-1 text-4xl">packages &amp; sessions</h1>
	<p class="text-base-content/60 mb-6 text-sm">
		prepaid session bundles, one per coach. sessions are drawn when you book.
	</p>

	{#if data.user.role !== 'client'}
		<p class="text-base-content/60">the {data.user.role} portal is coming soon.</p>
	{:else}
		<!-- your packages -->
		<h2 class="font-headings mb-3 text-xl">your packages</h2>
		{#if packages.length === 0}
			<div class="border-base-300 text-base-content/45 mb-8 rounded-sm border border-dashed p-8 text-center text-sm">
				no active packages. pick one below to get started.
			</div>
		{:else}
			<div class="mb-8 grid gap-3 sm:grid-cols-2">
				{#each packages as p (p.id)}
					{@const percent = pct(p.sessionsRemaining, p.sessionsGranted)}
					<div class="border-base-300 bg-white rounded-sm border p-4">
						<div class="mb-1 flex items-baseline justify-between gap-2">
							<span class="font-headings text-lg">{p.packageName}</span>
							<span class="text-base-content/55 text-xs">{firstOf(p.coachName)}</span>
						</div>
						<div class="mb-2 flex items-end gap-2">
							<span class="font-headings text-3xl leading-none">{p.sessionsRemaining}</span>
							<span class="text-base-content/50 pb-0.5 text-xs">
								of {p.sessionsGranted} · {p.sessionLengthMin} min each
							</span>
						</div>
						<div class="bg-base-200 mb-1.5 h-1.5 overflow-hidden rounded-full">
							<div class="{barClass(percent)} h-full rounded-full" style:width="{percent}%"></div>
						</div>
						<div class="text-base-content/50 text-xs">
							expires {longDateNoYear(new Date(p.expiresAt), tz)}
						</div>

						{#if p.ledger.length > 0}
							<details class="mt-3">
								<summary class="text-base-content/60 cursor-pointer text-xs select-none">
									activity ({p.ledger.length})
								</summary>
								<ul class="mt-2 flex flex-col gap-1.5">
									{#each p.ledger as e, i (`${e.createdAt}-${i}`)}
										<li class="flex items-baseline justify-between gap-2 text-xs">
											<span class="text-base-content/70 min-w-0 flex-1 truncate">
												{ledgerLabel({ ...e, coachName: p.coachName })}
											</span>
											<span class="text-base-content/40 shrink-0">
												{relativeDay(new Date(e.createdAt), tz, today)}
											</span>
										</li>
									{/each}
								</ul>
							</details>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- awaiting verification -->
		{#if pending.length > 0}
			<h2 class="font-headings mb-3 text-xl">awaiting verification</h2>
			<div class="border-warning bg-warning/10 mb-8 rounded-sm border p-4 text-sm">
				<p class="text-base-content/70 mb-3 text-xs">
					you've submitted payment for these — your coach confirms it, then the sessions land on your
					account. usually a few hours.
				</p>
				<ul class="flex flex-col gap-2">
					{#each pending as inv (inv.id)}
						<li class="flex items-baseline justify-between gap-2">
							<span>{inv.packageName} · {firstOf(inv.coachName)} · {inv.sessionCount} sessions</span>
							<span class="text-base-content/55 font-body text-xs">
								<span class="uppercase">{sgd(inv.amountCents)}</span> · {relativeDay(
									new Date(inv.issuedAt),
									tz,
									today
								)}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- get more sessions -->
		<h2 class="font-headings mb-1 text-xl">get more sessions</h2>
		<p class="text-base-content/60 mb-4 text-sm">
			buy a package with any coach. <a class="link" href="/bookings">see coach pages →</a>
		</p>
		<div class="flex flex-col gap-5">
			{#each byCoach as g (g.coachSlug)}
				<div>
					<div class="mb-2 flex items-baseline gap-2">
						<a class="font-headings text-lg hover:underline" href="/bookings/{g.coachSlug}">
							{g.coachName}
						</a>
					</div>
					<div class="grid gap-2 sm:grid-cols-2">
						{#each g.items as pk (pk.id)}
							<div class="border-base-300 bg-white flex items-center justify-between gap-3 rounded-sm border p-3">
								<div class="min-w-0">
									<div class="text-sm font-medium">{pk.name}</div>
									<div class="text-base-content/55 text-xs">
										{pk.sessionCount} × {pk.sessionLengthMin} min ·
										<span class="uppercase">{sgd(pk.pricePerSessionCents)}</span>/session · {pk.validityDays}d
									</div>
								</div>
								<button class="btn btn-xs btn-primary shrink-0" onclick={() => buy(pk)}>
									{sgd(pk.pricePerSessionCents * pk.sessionCount)}
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if buyTarget}
		<BuyPackageModal pkg={buyTarget} stripeEnabled={data.stripeEnabled} bind:open={buyOpen} />
	{/if}
</div>
