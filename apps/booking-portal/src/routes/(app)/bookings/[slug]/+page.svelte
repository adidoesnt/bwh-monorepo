<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ChevronLeftIcon } from '@repo/ui';
	import {
		dayNumber,
		formatMinuteRange,
		formatPriceCents,
		formatTime,
		weekdayAbbrev
	} from '$lib/utils/format';
	import type { PageProps } from './$types';
	import {
		SESSION_TYPES,
		cheapestPackagePriceCents,
		dateForParts,
		dateParamValue,
		enumerateDateRange,
		isClient,
		sameDate
	} from './coach';

	let { data }: PageProps = $props();

	const clientView = $derived(isClient(data));
	const priceCents = $derived(cheapestPackagePriceCents(data.packages));
	const shareUrl = $derived(data.shareUrl);

	let copied = $state(false);
	const copyLink = async () => {
		await navigator.clipboard.writeText(shareUrl);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	};

	const dateOptions = $derived(enumerateDateRange(data.today, data.rangeEnd, data.coach.timezone));
	const selectedStartsAt = $derived(page.url.searchParams.get('startsAt'));

	let note = $state('');

	const updateUrl = (updates: Record<string, string | null>) => {
		const url = new URL(page.url);
		for (const [key, value] of Object.entries(updates)) {
			if (value === null) url.searchParams.delete(key);
			else url.searchParams.set(key, value);
		}
		goto(url, { keepFocus: true, noScroll: true });
	};

	const setSessionType = (type: string) =>
		updateUrl({
			type: type === '1:1 in-person' ? null : type,
			package: null,
			date: null,
			startsAt: null
		});

	const setPackage = (purchaseId: string) => updateUrl({ package: purchaseId, date: null, startsAt: null });

	const setDate = (date: { year: number; month: number; day: number }) =>
		updateUrl({ date: dateParamValue(date), startsAt: null });

	const setStartsAt = (iso: string) => updateUrl({ startsAt: iso });
</script>

<div class="mx-auto max-w-3xl p-6 md:p-10">
	<div class="bg-base-100 border-base-300 flex flex-col gap-6 rounded-2xl border p-6 md:p-8">
		<a
			href="/bookings"
			class="text-base-content/70 hover:text-base-content flex w-fit items-center gap-1 text-sm"
		>
			<ChevronLeftIcon className="h-3 w-3" />
			all coaches
		</a>

		{#if clientView}
			<div class="bg-neutral text-neutral-content flex flex-col gap-4 rounded-2xl p-6">
				<div class="flex items-center gap-4">
					<div
						class="bg-base-100/10 text-neutral-content grid h-16 w-16 shrink-0 place-items-center rounded-full font-headings text-2xl"
					>
						{data.coach.name[0]}
					</div>
					<div class="min-w-0">
						<h1 class="font-headings text-3xl">{data.coach.name.split(' ')[0]}</h1>
						<p class="text-neutral-content/70">{data.coach.tagline}</p>
					</div>
				</div>
				<div class="flex flex-wrap gap-2">
					{#each data.coach.tags as tag (tag)}
						<span class="badge badge-sm bg-base-100/10 text-neutral-content border-none font-body"
							>{tag}</span
						>
					{/each}
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="bg-base-200 rounded-2xl p-4">
					<div class="text-base-content/60 text-sm">rate</div>
					<div class="text-lg font-medium">
						{priceCents !== null ? `from ${formatPriceCents(priceCents)} per session` : 'no packages yet'}
					</div>
				</div>
				<div class="bg-base-200 rounded-2xl p-4">
					<div class="text-base-content/60 text-sm">trains at</div>
					<div class="text-lg font-medium">{data.coach.locations.join(' · ')}</div>
				</div>
			</div>

			<p class="text-base-content/80">{data.coach.bio}</p>

			<div class="bg-base-200 flex items-center justify-between gap-3 rounded-2xl p-4">
				<span class="font-mono text-sm">{shareUrl}</span>
				<button
					type="button"
					class="btn btn-sm border-base-300 bg-base-100 text-base-content/60 font-normal"
					onclick={copyLink}
				>
					{copied ? 'copied' : 'copy link'}
				</button>
			</div>

			<div>
				<div class="text-base-content/60 text-xs tracking-wide uppercase">open hours</div>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each data.openHours as window (window.startMin)}
						<span class="badge badge-lg bg-base-200 border-none font-mono">
							{formatMinuteRange(window.startMin, window.endMin)}
						</span>
					{/each}
				</div>
			</div>

			<div class="border-base-300 flex flex-col gap-6 border-t pt-6">
				<div>
					<h2 class="font-headings text-2xl">book {data.coach.name.split(' ')[0]}</h2>
					<p class="text-base-content/60 text-sm">
						you're asking for a slot, not taking it. your coach approves, then it's locked in.
					</p>
				</div>

				<div>
					<div class="text-base-content/60 mb-2 text-sm">session type</div>
					<div class="flex flex-wrap gap-2">
						{#each SESSION_TYPES as type (type)}
							{#if data.allowedTypes.includes(type)}
								<button
									type="button"
									class="btn btn-sm rounded-full font-normal {data.sessionType === type
										? 'btn-neutral'
										: 'border-base-300 bg-base-100 text-base-content/70'}"
									onclick={() => setSessionType(type)}
								>
									{type}
								</button>
							{:else}
								<span
									class="btn btn-sm border-base-300 bg-base-100 text-base-content/30 rounded-full font-normal line-through"
									aria-disabled="true"
									title={!data.parqSubmitted
										? "not submitted a health screening yet — only free consult until then"
										: 'this coach is in a different timezone — only remote-friendly types'}
								>
									{type}
								</span>
							{/if}
						{/each}
					</div>
				</div>

				{#if data.sessionType !== 'free consult'}
					{#if data.activePackages.length === 0}
						<div class="bg-base-200 rounded-2xl p-4 text-sm">
							get a {data.coach.name.split(' ')[0]} package to book — see the packages above.
						</div>
					{:else}
						<div>
							<div class="text-base-content/60 mb-2 text-sm">package</div>
							<div class="flex flex-wrap items-center gap-2">
								{#each data.activePackages as pkg (pkg.purchaseId)}
									<span class="inline-flex items-center gap-1">
										<button
											type="button"
											class="btn btn-sm rounded-full font-normal {data.selectedPurchase?.purchaseId ===
											pkg.purchaseId
												? 'btn-neutral'
												: 'border-base-300 bg-base-100 text-base-content/70'}"
											onclick={() => setPackage(pkg.purchaseId)}
										>
											{pkg.packageName} · {pkg.bookable} left
										</button>
										{#if pkg.holds > 0}
											<span
												class="tooltip text-base-content/40 cursor-help text-xs"
												data-tip="{pkg.balance} total · {pkg.holds} pending elsewhere · {pkg.bookable} available now"
											>
												ⓘ
											</span>
										{/if}
									</span>
								{/each}
							</div>
						</div>
					{/if}
				{/if}

				{#if data.durationMin}
					<div>
						<div class="text-base-content/60 mb-2 text-sm">date</div>
						<div class="flex gap-2 overflow-x-auto pb-1">
							{#each dateOptions as date (dateParamValue(date))}
								<button
									type="button"
									class="btn flex h-auto shrink-0 flex-col gap-0 rounded-field py-1.5 font-normal {sameDate(
										data.selectedDate,
										date
									)
										? 'btn-neutral'
										: 'border-base-300 bg-base-100 text-base-content/70'}"
									onclick={() => setDate(date)}
								>
									<span class="text-[10px] opacity-70"
										>{weekdayAbbrev(dateForParts(date, data.coach.timezone), data.coach.timezone)}</span
									>
									<span class="font-headings text-lg">{date.day}</span>
								</button>
							{/each}
						</div>
					</div>

					<div>
						<div class="text-base-content/60 mb-2 text-sm">
							time · {data.coach.name.split(' ')[0]} fits {data.durationMin}-min starts here
						</div>
						{#if data.slots.length === 0}
							<p class="text-base-content/60 text-sm">no open starts this day — try another date.</p>
						{:else}
							<div class="flex flex-wrap gap-2">
								{#each data.slots as slot (slot.start.toISOString())}
									{#if slot.available}
										<button
											type="button"
											class="btn btn-sm rounded-full font-mono font-normal {selectedStartsAt ===
											slot.start.toISOString()
												? 'btn-neutral'
												: 'border-base-300 bg-base-100 text-base-content/70'}"
											onclick={() => setStartsAt(slot.start.toISOString())}
										>
											{formatTime(slot.start, data.coach.timezone)}
										</button>
									{:else}
										<span
											class="btn btn-sm border-base-300 bg-base-100 text-base-content/30 rounded-full font-mono font-normal line-through"
											aria-disabled="true"
										>
											{formatTime(slot.start, data.coach.timezone)}
										</span>
									{/if}
								{/each}
							</div>
						{/if}
					</div>

					{#if data.sessionType !== '1:1 online' && data.coach.locations.filter((l) => l !== 'online').length > 0}
						<div>
							<label class="text-base-content/60 mb-2 block text-sm" for="location">location</label>
							<select id="location" class="select select-bordered w-full">
								{#each data.coach.locations.filter((l) => l !== 'online') as location (location)}
									<option value={location}>{location}</option>
								{/each}
							</select>
						</div>
					{/if}

					<div>
						<label class="text-base-content/60 mb-2 block text-sm" for="note">anything i should know?</label>
						<textarea
							id="note"
							bind:value={note}
							class="textarea textarea-bordered w-full"
							placeholder="niggling left knee this week — happy to swap lunges"
						></textarea>
					</div>

					{#if selectedStartsAt}
						<div class="bg-base-200 flex items-center justify-between gap-3 rounded-2xl p-4 text-sm">
							<span>
								{data.sessionType} · {weekdayAbbrev(new Date(selectedStartsAt), data.coach.timezone)}
								{dayNumber(new Date(selectedStartsAt), data.coach.timezone)} · {formatTime(
									new Date(selectedStartsAt),
									data.coach.timezone
								)}
							</span>
							<span class="font-medium">
								{data.sessionType === 'free consult' ? 'free' : '1 session'}
							</span>
						</div>
					{/if}

					<button
						type="button"
						class="btn btn-accent w-full"
						disabled={!selectedStartsAt}
						title="coming soon"
					>
						send request
					</button>
				{/if}
			</div>
		{:else}
			<p class="text-base-content/60 max-w-sm">
				the {data.user.role} portal is coming soon — your tools will live here.
			</p>
		{/if}
	</div>
</div>
