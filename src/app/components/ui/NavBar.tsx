"use client";

import { useState } from "react";
import { Dialog, DialogPanel, Popover, PopoverButton, PopoverGroup, PopoverPanel } from "@headlessui/react";
import { ArrowPathIcon, Bars3Icon, ChartPieIcon, CursorArrowRaysIcon, FingerPrintIcon, SquaresPlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ChevronDownIcon, PhoneIcon, PlayCircleIcon } from "@heroicons/react/20/solid";

const products = [
	{ name: "Analytics", description: "Get a better understanding of your traffic", href: "#", icon: ChartPieIcon },
	{ name: "Engagement", description: "Speak directly to your customers", href: "#", icon: CursorArrowRaysIcon },
	{ name: "Security", description: "Your customers’ data will be safe and secure", href: "#", icon: FingerPrintIcon },
	{ name: "Integrations", description: "Connect with third-party tools", href: "#", icon: SquaresPlusIcon },
	{ name: "Automations", description: "Build strategic funnels that will convert", href: "#", icon: ArrowPathIcon },
];
const callsToAction = [
	{ name: "Watch demo", href: "#", icon: PlayCircleIcon },
	{ name: "Contact sales", href: "#", icon: PhoneIcon },
];
const company = [
	{ name: "About us", href: "#", description: "Learn more about our company values and mission to empower others" },
	{ name: "Careers", href: "#", description: "Looking for you next career opportunity? See all of our open positions" },
	{
		name: "Support",
		href: "#",
		description: "Get in touch with our dedicated support team or reach out on our community forums",
	},
	{ name: "Blog", href: "#", description: "Read our latest announcements and get perspectives from our team" },
];

const NavBar = () => {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	return (
		<header className="bg-white z-[99] w-full fixed top-0">
			<nav aria-label="Global" className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 lg:px-8">
				<div className="flex lg:flex-1">
					<a href="/" className="-m-1.5 p-1.5">
						<span className="sr-only">CastleSwim</span>
						<img alt="CastleSwim Logo" src="https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/X1LQYi2rEkolCwaxzST4/media/644eaaf7208b4e2264148088.png" className="h-16 w-auto" />
					</a>
				</div>
				<div className="flex lg:hidden">
					<button type="button" onClick={() => setMobileMenuOpen(true)} className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700">
						<span className="sr-only">Open main menu</span>
						<Bars3Icon aria-hidden="true" className="h-6 w-6" />
					</button>
				</div>
				<PopoverGroup className="hidden lg:flex lg:gap-x-12">
					<a href="/" className="text-sm font-semibold leading-6 text-gray-900">
						Map
					</a>

					<a href="/leaderboards" className="text-sm font-semibold leading-6 text-gray-900">
						Leaderboards
					</a>
					
				</PopoverGroup>
				<div className="hidden lg:flex lg:flex-1 lg:justify-end">
					<a href="/auth/signin" className="text-sm font-semibold leading-6 text-gray-900">
						Swimmers Dashboard <span aria-hidden="true">&rarr;</span>
					</a>
				</div>
			</nav>
			<Dialog open={mobileMenuOpen} onClose={setMobileMenuOpen} className="lg:hidden">
				<div className="fixed inset-0 z-10" />
				<DialogPanel className="fixed inset-y-0 right-0 z-10 flex w-full flex-col justify-between overflow-y-auto bg-white sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
					<div className="p-6">
						<div className="flex items-center justify-between">
							<a href="/map" className="-m-1.5 p-1.5">
								<span className="sr-only">CastleSwim</span>
								<img alt="CastleSwim Logo" src="/vercel.svg" className="h-8 w-auto" />
							</a>
							<button type="button" onClick={() => setMobileMenuOpen(false)} className="-m-2.5 rounded-md p-2.5 text-gray-700">
								<span className="sr-only">Close menu</span>
								<XMarkIcon aria-hidden="true" className="h-6 w-6" />
							</button>
						</div>
						<div className="mt-6 flow-root">
							<div className="-my-6 divide-y divide-gray-500/10">
								<div className="space-y-2 py-6">
									<a href="/" className="block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50">Map</a>
									<a href="/leaderboards" className="block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50">Leaderboards</a>
								</div>
								<div className="py-6">
									<a href="/auth/signin" className="block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50">Swimmers</a>
								</div>
							</div>
						</div>
					</div>
					<div className="sticky bottom-0 grid grid-cols-2 divide-x divide-gray-900/5 bg-gray-50 text-center">
						{callsToAction.map((item) => (
							<a key={item.name} href={item.href} className="p-3 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-100">
								{item.name}
							</a>
						))}
					</div>
				</DialogPanel>
			</Dialog>
		</header>
	);
}

export default NavBar;
