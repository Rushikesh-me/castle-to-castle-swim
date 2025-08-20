
import { forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useRef } from "react";

import { GoogleMapsContext, useMapsLibrary } from "@vis.gl/react-google-maps";

import type { Ref } from "react";

type PolylineEventProps = {
	onClick?: (e: google.maps.MapMouseEvent) => void;
	onDrag?: (e: google.maps.MapMouseEvent) => void;
	onDragStart?: (e: google.maps.MapMouseEvent) => void;
	onDragEnd?: (e: google.maps.MapMouseEvent) => void;
	onMouseOver?: (e: google.maps.MapMouseEvent) => void;
	onMouseOut?: (e: google.maps.MapMouseEvent) => void;
};

type PolylineCustomProps = {
	/**
	 * this is an encoded string for the path, will be decoded and used as a path
	 */
	encodedPath?: string;
};

export type PolylineProps = google.maps.PolylineOptions & PolylineEventProps & PolylineCustomProps;

export type PolylineRef = Ref<google.maps.Polyline | null>;

function usePolyline(props: PolylineProps) {
	const { onClick, onDrag, onDragStart, onDragEnd, onMouseOver, onMouseOut, encodedPath, ...polylineOptions } = props;

	// This is here to avoid triggering the useEffect below when the callbacks change
	const callbacks = useRef<Record<string, (e: unknown) => void>>({});
	Object.assign(callbacks.current, {
		onClick,
		onDrag,
		onDragStart,
		onDragEnd,
		onMouseOver,
		onMouseOut,
	});

	const geometryLibrary = useMapsLibrary("geometry");

	const polyline = useRef(new google.maps.Polyline()).current;

	// update PolylineOptions
	useMemo(() => {
		// Validate path coordinates before setting options
		if (polylineOptions.path && Array.isArray(polylineOptions.path)) {
			const validPath = polylineOptions.path.filter(point => 
				point && 
				typeof point.lat === 'number' && 
				typeof point.lng === 'number' &&
				isFinite(point.lat) && 
				isFinite(point.lng) &&
				point.lat >= -90 && point.lat <= 90 &&
				point.lng >= -180 && point.lng <= 180
			);
			

			
			polyline.setOptions({
				...polylineOptions,
				path: validPath
			});
		} else {
			polyline.setOptions(polylineOptions);
		}
	}, [polyline, polylineOptions]);

	const map = useContext(GoogleMapsContext)?.map;

	// update the path with the encodedPath
	useMemo(() => {
		if (!encodedPath || !geometryLibrary) return;
		try {
			const path = geometryLibrary.encoding.decodePath(encodedPath);
			// Validate decoded path coordinates
			const validPath = path.filter(point => 
				point && 
				typeof point.lat === 'number' && 
				typeof point.lng === 'number' &&
				isFinite(point.lat()) && 
				isFinite(point.lng()) &&
				point.lat() >= -90 && point.lat() <= 90 &&
				point.lng() >= -180 && point.lng() <= 180
			);
			

			
			polyline.setPath(validPath);
		} catch (error) {
			// Silently handle decoding errors
		}
	}, [polyline, encodedPath, geometryLibrary]);

	// create polyline instance and add to the map once the map is available
	useEffect(() => {
		if (!map) {
			if (map === undefined) {
			// Component must be inside a Map component
		}

			return;
		}

		polyline.setMap(map);

		return () => {
			polyline.setMap(null);
		};
	}, [map]);

	// attach and re-attach event-handlers when any of the properties change
	useEffect(() => {
		if (!polyline) return;

		// Add event listeners
		const gme = google.maps.event;
		[
			["click", "onClick"],
			["drag", "onDrag"],
			["dragstart", "onDragStart"],
			["dragend", "onDragEnd"],
			["mouseover", "onMouseOver"],
			["mouseout", "onMouseOut"],
		].forEach(([eventName, eventCallback]) => {
			gme.addListener(polyline, eventName, (e: google.maps.MapMouseEvent) => {
				const callback = callbacks.current[eventCallback];
				if (callback) callback(e);
			});
		});

		return () => {
			gme.clearInstanceListeners(polyline);
		};
	}, [polyline]);

	return polyline;
}

/**
 * Component to render a polyline on a map
 */

export const Polyline = forwardRef((props: PolylineProps, ref: PolylineRef) => {
	const polyline = usePolyline(props);
	useImperativeHandle(ref, () => polyline, []);
	return null;
});
Polyline.displayName = "Polyline"
