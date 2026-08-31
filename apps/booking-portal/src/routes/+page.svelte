<script lang="ts">
	import { Button } from '@repo/ui';

	let mode = $state<'login' | 'signup'>('login');

	let email = $state('');
	let password = $state('');
	let keepLoggedIn = $state(true);

	let firstName = $state('');
	let lastName = $state('');
	let mobile = $state('');
	let agreedToTerms = $state(false);

	const copy = $derived(
		mode === "login"
			? {
					heading: 'welcome back.',
					subheading: 'log in to manage your sessions.',
					submitLabel: 'log in',
					switchLabel: 'new here? create an account'
				}
			: {
					heading: "let's get you started.",
					subheading: 'two minutes now, then health screening before your first session.',
					submitLabel: 'create account',
					switchLabel: 'i already have an account'
				}
	);

	function switchMode() {
		mode = mode === "login" ? "signup" : "login";
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		// placeholder: no auth wired up yet
		if (mode === "login") {
			console.log('login placeholder', { email, password, keepLoggedIn });
		} else {
			console.log('signup placeholder', { firstName, lastName, email, mobile, password, agreedToTerms });
		}
	}
</script>

<div class="grid h-full w-full grid-cols-1 md:grid-cols-2">
	<div class="bg-neutral text-neutral-content flex flex-col justify-between gap-8 p-8 md:p-12">
		<p class="font-body text-neutral-content/70 text-sm tracking-widest">
			training@<span class="text-neutral-content font-bold">builtwithhabit</span>
		</p>

		<div class="flex flex-col gap-6">
			<h1 class="font-headings text-4xl leading-tight md:text-5xl">
				sweat smarter,<br />
				<span class="text-accent italic">live stronger.</span>
			</h1>

			<p class="font-body text-neutral-content/70 max-w-sm text-base md:text-lg">
				your sessions, your packages and your progress — all in one place. request a slot, we'll
				confirm it.
			</p>
		</div>

		<div
			class="border-neutral-content/10 relative flex h-40 items-center justify-center overflow-hidden rounded-box border"
			style="background-image: repeating-linear-gradient(45deg, color-mix(in srgb, var(--color-neutral-content) 10%, transparent) 0 12px, transparent 12px 24px);"
		>
			<p class="font-body text-neutral-content/50 text-sm tracking-wide">gym / lifestyle photo</p>
		</div>
	</div>

	<div class="bg-base-100 flex items-center justify-center p-8 md:p-12">
		<form class="flex w-full max-w-sm flex-col gap-6" onsubmit={handleSubmit}>
			<div class="flex flex-col gap-1">
				<h2 class="font-headings text-base-content text-4xl">{copy.heading}</h2>
				<p class="font-body text-base-content/60">{copy.subheading}</p>
			</div>

			<div class="flex flex-col gap-4">
				{#if mode === "signup"}
					<div class="grid grid-cols-2 gap-4">
						<label class="flex flex-col gap-1" for="firstName">
							<span class="font-body text-base-content/70 text-sm">first name</span>
							<input
								id="firstName"
								type="text"
								placeholder="ishita"
								class="input w-full"
								bind:value={firstName}
								required
							/>
						</label>

						<label class="flex flex-col gap-1" for="lastName">
							<span class="font-body text-base-content/70 text-sm">last name</span>
							<input
								id="lastName"
								type="text"
								placeholder="tan"
								class="input w-full"
								bind:value={lastName}
								required
							/>
						</label>
					</div>
				{/if}

				<label class="flex flex-col gap-1" for="email">
					<span class="font-body text-base-content/70 text-sm">email</span>
					<input
						id="email"
						type="email"
						placeholder="you@example.com"
						class="input w-full"
						bind:value={email}
						required
					/>
				</label>

				{#if mode === "signup"}
					<label class="flex flex-col gap-1" for="mobile">
						<span class="font-body text-base-content/70 text-sm">mobile (for session reminders)</span>
						<input
							id="mobile"
							type="tel"
							placeholder="+65 8000 0000"
							class="input w-full"
							bind:value={mobile}
							required
						/>
					</label>
				{/if}

				<label class="flex flex-col gap-1" for="password">
					<span class="font-body text-base-content/70 text-sm">password</span>
					<input
						id="password"
						type="password"
						placeholder={mode === "signup" ? 'at least 8 characters' : '••••••••'}
						class="input w-full"
						bind:value={password}
						minlength={mode === "signup" ? 8 : undefined}
						required
					/>
				</label>
			</div>

			{#if mode === 'login'}
				<div class="flex items-center justify-between">
					<label class="flex items-center gap-2">
						<input type="checkbox" class="checkbox checkbox-primary" bind:checked={keepLoggedIn} />
						<span class="font-body text-base-content/80 text-sm">keep me logged in</span>
					</label>

					<a href="/forgot-password" class="font-body text-accent text-sm hover:underline">
						forgot password?
					</a>
				</div>
			{:else}
				<label class="flex items-start gap-2">
					<input
						type="checkbox"
						class="checkbox checkbox-primary mt-0.5"
						bind:checked={agreedToTerms}
						required
					/>
					<span class="font-body text-base-content/80 text-sm">
						i agree to the terms, privacy notice and the 24-hour cancellation policy.
					</span>
				</label>
			{/if}

			<div class="flex flex-col gap-3">
				<Button type="submit" variant="accent" class="text-accent-content w-full">
					{copy.submitLabel}
				</Button>
				<Button variant="outline" class="w-full" onclick={switchMode}>
					{copy.switchLabel}
				</Button>
			</div>

			{#if mode === 'login'}
				<p class="font-body text-base-content/50 text-xs">
					by logging in you agree to our terms and privacy notice. health information you share is
					handled under singapore's pdpa.
				</p>
			{/if}
		</form>
	</div>
</div>
