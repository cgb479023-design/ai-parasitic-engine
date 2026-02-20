import React, { useState, useRef, useMemo } from 'react';
import { ShortsData } from '../types';

// 📈 Interactive Chart Component
export const InteractiveChart = ({ data, color, label, shortsList, publishedVideos }: { data: any, color: string, label: string, shortsList?: ShortsData[], publishedVideos?: any[] }) => {
    const [hover, setHover] = useState<{ x: number, y: number, value: string, date: string } | null>(null);
    const [markerHover, setMarkerHover] = useState<{ x: number, y?: number, label: string, videos?: any[], count?: number, countText?: string, date?: string, details?: any } | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const pathRef = useRef<SVGPathElement>(null);

    // Calculate markers from publishedVideos (priority) or shortsList as fallback
    const computedMarkers = useMemo(() => {
        // 1. Use scraped markers from content script (Highest Priority)
        if (data.markers && data.markers.length > 0) {
            // Keep markers with percentage value (0-100), will be converted during render
            return data.markers.map((m: any, idx: number) => ({
                ...m,
                // Store raw percentage, will be converted to viewBox coords in render
                xPercent: m.x,
                index: idx
            }));
        }

        // 2. Use publishedVideos from X-axis enhancement
        if (publishedVideos && publishedVideos.length > 0) {
            const dateLabels = data.dateLabels || data.labels || [];
            const markers: any[] = [];

            console.log(`📊 [Markers] publishedVideos:`, publishedVideos.length, `dateLabels:`, dateLabels.length);

            // Group videos by date
            const videosByDate: { [key: string]: any[] } = {};
            publishedVideos.forEach(video => {
                const dateKey = video.publishDate || 'Unknown';
                if (!videosByDate[dateKey]) videosByDate[dateKey] = [];
                videosByDate[dateKey].push(video);
            });

            console.log(`📊 [Markers] Grouped videos by date:`, Object.keys(videosByDate));

            // If we have date labels, try to match
            if (dateLabels.length > 0) {
                dateLabels.forEach((dateLabel: string, index: number) => {
                    const matchKey = Object.keys(videosByDate).find(key => {
                        // 1. Exact match (Best)
                        if (key === dateLabel) return true;

                        // 2. Strict partial match (e.g. "Dec 8, 2025" vs "Dec 8")
                        // Ensure we match the month AND day
                        const normalize = (str: string) => str.replace(/,?\s*\d{4}$/, '').trim();
                        if (normalize(key) === normalize(dateLabel)) return true;

                        // 3. Date object comparison (Robust)
                        try {
                            // Add current year if missing for parsing
                            const d1Str = key.match(/\d{4}/) ? key : `${key}, ${new Date().getFullYear()}`;
                            const d2Str = dateLabel.match(/\d{4}/) ? dateLabel : `${dateLabel}, ${new Date().getFullYear()}`;

                            const d1 = new Date(d1Str);
                            const d2 = new Date(d2Str);

                            if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
                                // Match Month and Date
                                if (d1.getMonth() !== d2.getMonth() || d1.getDate() !== d2.getDate()) return false;

                                // Match Year if both have it
                                const y1 = key.match(/(\d{4})/)?.[1];
                                const y2 = dateLabel.match(/(\d{4})/)?.[1];
                                if (y1 && y2 && y1 !== y2) return false;

                                return true;
                            }
                        } catch (e) { }

                        return false;
                    });

                    if (matchKey && videosByDate[matchKey]) {
                        markers.push({
                            x: (index / Math.max(dateLabels.length - 1, 1)) * 100,
                            count: videosByDate[matchKey].length,
                            label: dateLabel,
                            date: matchKey,
                            videos: videosByDate[matchKey]
                        });
                        // Remove matched to avoid duplicates
                        delete videosByDate[matchKey];
                    }
                });
            }

            // 🆕 FALLBACK: If no matches found or no dateLabels, create a single summary marker
            const remainingDates = Object.keys(videosByDate);
            if (remainingDates.length > 0) {
                // Combine all remaining videos into markers at fixed positions
                const allRemainingVideos = remainingDates.flatMap(d => videosByDate[d]);

                if (markers.length === 0) {
                    // No date labels - show all videos grouped in center
                    markers.push({
                        x: 50,
                        count: allRemainingVideos.length,
                        label: `${allRemainingVideos.length} Videos`,
                        date: 'This Period',
                        videos: allRemainingVideos
                    });
                    console.log(`📊 [Markers] Fallback: Created center marker with ${allRemainingVideos.length} videos`);
                } else {
                    // Some matched, add remaining to end
                    console.log(`📊 [Markers] ${remainingDates.length} dates didn't match, adding to end marker`);
                }
            }

            if (markers.length > 0) {
                console.log(`📊 [Markers] Created ${markers.length} markers from publishedVideos`);
                return markers;
            }
        }

        // FALLBACK: Use shortsList
        if (!shortsList || shortsList.length === 0) {
            console.log(`📊 [Markers] No shortsList available (${shortsList?.length || 0} items)`);
            return [];
        }
        if (!data.dateLabels && !data.labels) {
            console.log(`📊 [Markers] No dateLabels available`);
            return [];
        }

        const dateLabels = data.dateLabels || data.labels || [];
        const markers: any[] = [];

        // Helper: Parse date string into normalized format for comparison
        const parseDate = (dateStr: string): { month: number, day: number, year?: number } | null => {
            if (!dateStr) return null;

            // Format: "Dec 4, 2025" or "Dec 4"
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const match1 = dateStr.match(/([A-Za-z]{3})\s*(\d{1,2})(?:,?\s*(\d{4}))?/);
            if (match1) {
                const monthIdx = monthNames.findIndex(m => m.toLowerCase() === match1[1].toLowerCase());
                if (monthIdx >= 0) {
                    return { month: monthIdx + 1, day: parseInt(match1[2]), year: match1[3] ? parseInt(match1[3]) : undefined };
                }
            }

            // Format: "2025/12/04" or "12/4/2025"
            const match2 = dateStr.match(/(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/);
            if (match2) {
                const [_, a, b, c] = match2;
                if (a.length === 4) return { year: parseInt(a), month: parseInt(b), day: parseInt(c) }; // YYYY/MM/DD
                return { month: parseInt(a), day: parseInt(b), year: parseInt(c) }; // MM/DD/YYYY
            }

            return null;
        };

        // Helper: Check if two dates match (ignoring year for flexibility)
        const datesMatch = (date1: string, date2: string): boolean => {
            const p1 = parseDate(date1);
            const p2 = parseDate(date2);
            if (!p1 || !p2) {
                // Fallback to string matching
                return date1.includes(date2) || date2.includes(date1.split(',')[0]);
            }
            // Match month and day (year is optional)
            return p1.month === p2.month && p1.day === p2.day;
        };

        console.log(`📊 [Markers] Matching ${shortsList.length} videos against ${dateLabels.length} date labels`);

        dateLabels.forEach((dateLabel: string, index: number) => {
            // Match videos by date using enhanced matching
            const matchedVideos = shortsList.filter(v => {
                if (!v.date) return false;
                return datesMatch(v.date, dateLabel);
            });

            if (matchedVideos.length > 0) {
                markers.push({
                    x: (index / Math.max(dateLabels.length - 1, 1)) * 100,
                    count: matchedVideos.length,
                    label: dateLabel,
                    date: dateLabel,
                    videos: matchedVideos
                });
            }
        });

        console.log(`📊 [Markers] Found ${markers.length} markers with videos`);

        return markers;
    }, [data, shortsList, publishedVideos]);

    const path = data?.path;
    const viewBoxFromData = data?.viewBox;

    // 📐 Compute path bounds and return path + viewBox info
    const pathData = useMemo(() => {
        const validPath = path;


        // 🚀 DIRECT PASS-THROUGH: Use the exact path and viewBox captured from YouTube
        if (validPath && validPath.length > 10) {
            let viewBox = viewBoxFromData;
            let minX = 0, maxX = 100, minY = 0, maxY = 50;

            if (viewBox) {
                // Use captured viewBox
                const parts = viewBox.toString().split(' ').map(Number).filter(n => !isNaN(n));
                // 🚨 CHECK: If bbox is 0 0 0 0 (hidden element), trigger fallback!
                if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
                    minX = parts[0];
                    minY = parts[1];
                    const width = parts[2];
                    const height = parts[3];
                    maxX = minX + width;
                    maxY = minY + height;
                } else {
                    console.warn(`📊 [${label}] Invalid viewBox "${viewBox}", triggering fallback calculation...`);
                    viewBox = null; // Force fallback
                }
            }

            if (!viewBox) {
                // 🚨 FALLBACK: Calculate bounds from path string if viewBox is missing
                // This ensures the chart is visible even if the content script didn't send bounds
                console.log(`📊 [${label}] Missing viewBox, calculating from path...`);
                const nums = validPath.match(/-?[\d.]+/g)?.map(Number) || [];
                if (nums.length > 4) {
                    let mx = Infinity, Mx = -Infinity, my = Infinity, My = -Infinity;

                    // 🔧 OPTIMIZATION: Area charts close back to the bottom (maxY).
                    // This causes the bbox to include empty space below.
                    // Ignore the last 20% of coordinates to exclude the return path to the baseline.
                    const scanLimit = nums.length > 50 ? Math.floor(nums.length * 0.8) : nums.length;

                    for (let i = 0; i < scanLimit; i += 2) {
                        const x = nums[i];
                        const y = nums[i + 1];
                        if (!isNaN(x)) {
                            if (x < mx) mx = x;
                            if (x > Mx) Mx = x;
                        }
                        if (!isNaN(y)) {
                            if (y < my) my = y;
                            if (y > My) My = y;
                        }
                    }

                    // Add tighter padding
                    const width = Mx - mx;
                    const height = My - my;

                    if (width <= 0 || height <= 0) {
                        viewBox = "0 0 100 50";
                    } else {
                        const padX = width * 0.02;
                        const padY = height * 0.1;
                        minX = mx - padX;
                        maxX = Mx + padX;
                        minY = my - padY;
                        maxY = My + padY;

                        viewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
                    }
                    console.log(`📊 [${label}] Calculated optimized viewBox: ${viewBox}`);
                } else {
                    viewBox = "0 0 100 50";
                }
            }

            console.log(`📊 [${label}] Final viewBox: ${viewBox}`);

            return {
                path: validPath,
                viewBox: viewBox,
                minX,
                maxX,
                minY,
                maxY
            };
        }

        // Fallback
        return { path: "M0,25 L25,20 L50,30 L75,15 L100,25", viewBox: "0 0 100 50", minX: 0, maxX: 100, minY: 0, maxY: 50 };
    }, [path, viewBoxFromData, label]);

    if (!data || !path) return null;

    const { path: normalizedPath, viewBox: dynamicViewBox, minX, maxX, minY, maxY } = pathData;

    // Use dynamic bounds or defaults
    const vbX = minX ?? 0;
    const vbY = minY ?? 0;
    const vbW = (maxX ?? 100) - vbX || 100;
    const vbH = (maxY ?? 50) - vbY || 50;

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!svgRef.current || !pathRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const height = rect.height;

        // Map mouse X to SVG X (0-100)
        const svgX = (x / width) * vbW;

        // NEW: Precise Data Points Logic (Tooltip)
        if (data.dataPoints && data.dataPoints.length > 0) {
            // Assume points are sorted by time (left to right)
            // Map mouse position percentage to index
            const percent = Math.max(0, Math.min(1, x / width));
            const index = Math.round(percent * (data.dataPoints.length - 1));
            const point = data.dataPoints[index];

            if (point) {
                // Parse label: "Views, Monday, December 8, 2025, 114,381"
                // or "Monday, December 8, 2025, Views: 114,381"
                let dateStr = '';
                let valueStr = '';

                const parts = point.label.split(',');
                if (parts.length >= 3) {
                    // Try to extract date and value
                    // Heuristic: Value is usually last, Date is in the middle
                    valueStr = parts[parts.length - 1].trim().replace(/[^0-9.,KMB]/g, '');

                    // Date: Try to find parts with day names or month names
                    const dateParts = parts.filter(p =>
                        p.match(/\d{4}/) ||
                        p.match(/[A-Z][a-z]{2,}/) ||
                        p.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i)
                    );
                    if (dateParts.length > 0) {
                        dateStr = dateParts.join(', ').trim();
                    }
                } else {
                    // Simple format: Just use the whole label
                    valueStr = point.label.replace(/[^0-9.,KMB]/g, '');
                    dateStr = point.label;
                }

                // Find Y on path for the hover circle
                const path = pathRef.current;
                const len = path.getTotalLength();
                const pointLen = (index / Math.max(data.dataPoints.length - 1, 1)) * len;
                const p = path.getPointAtLength(pointLen);

                setHover({
                    x: p.x,  // SVG viewBox coordinate (0-100)
                    y: p.y,  // SVG viewBox coordinate 
                    value: valueStr ? `${valueStr} views` : point.label,
                    date: dateStr || 'Unknown Date'
                });
                return;
            }
        }

        // Find Y on path (Binary Search) - Fallback
        const path = pathRef.current;
        const len = path.getTotalLength();
        let start = 0;
        let end = len;
        let targetPoint = path.getPointAtLength(0);

        for (let i = 0; i < 20; i++) {
            const mid = (start + end) / 2;
            const p = path.getPointAtLength(mid);
            if (p.x < svgX) {
                start = mid;
            } else {
                end = mid;
            }
            targetPoint = p;
        }

        // Map Y to Value (Y is inverted: low Y = high value)
        const maxY = data.maxY || 100;
        const ratio = 1 - (targetPoint.y / vbH);
        const value = maxY * Math.max(0, Math.min(1, ratio));

        // Map X to Date using dateLabels
        const percent = x / width;
        let dateStr = `Day ${Math.floor(percent * 28) + 1}`; // Fallback

        // Try to get date from dateLabels first, then labels
        const dateLabelsArray = data.dateLabels || (data.labels?.filter((l: string) => !/^[\d.,]+[KMB]?$/.test(l)) || []);
        if (dateLabelsArray.length > 1) {
            const index = Math.round(percent * (dateLabelsArray.length - 1));
            dateStr = dateLabelsArray[index] || dateStr;
        }

        setHover({
            x: targetPoint.x,  // SVG viewBox coordinate (0-100)
            y: targetPoint.y,  // SVG viewBox coordinate
            value: `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} views`,
            date: dateStr
        });
    };

    const handleMouseLeave = () => {
        setHover(null);
        setMarkerHover(null);
    };

    return (
        <div className="w-full h-full relative overflow-x-auto overflow-y-hidden" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
            <svg
                ref={svgRef}
                viewBox={dynamicViewBox || "0 0 100 58"}
                className="w-full h-full"
                preserveAspectRatio="none"
                style={{ minWidth: '100%', minHeight: '100%' }}
                onClick={() => setMarkerHover(null)}
            >
                {/* Grid Lines */}
                {/* Grid Lines - Adaptive */}
                <line x1={vbX} y1={vbY + vbH * 0.25} x2={vbX + vbW} y2={vbY + vbH * 0.25} stroke="white" strokeOpacity="0.05" strokeWidth={vbH * 0.005} />
                <line x1={vbX} y1={vbY + vbH * 0.50} x2={vbX + vbW} y2={vbY + vbH * 0.50} stroke="white" strokeOpacity="0.05" strokeWidth={vbH * 0.005} />
                <line x1={vbX} y1={vbY + vbH * 0.75} x2={vbX + vbW} y2={vbY + vbH * 0.75} stroke="white" strokeOpacity="0.05" strokeWidth={vbH * 0.005} />

                {/* Y-Axis Labels */}
                <text x="1" y="8" fill="white" fillOpacity="0.3" fontSize="3">{data.maxY || '100'}</text>
                <text x="1" y="48" fill="white" fillOpacity="0.3" fontSize="3">0</text>

                {/* Date Axis Labels - YouTube Studio Style */}
                {(() => {
                    let dateLabelsArray = data.dateLabels;
                    if (!dateLabelsArray || dateLabelsArray.length === 0) {
                        if (data.labels && Array.isArray(data.labels)) {
                            dateLabelsArray = data.labels.filter((l: string) => !/^[\d.,]+[KMB]?$/.test(l));
                        }
                    }
                    if (dateLabelsArray && dateLabelsArray.length > 0) {
                        // Show 4-5 labels evenly spaced like YouTube Studio
                        const labelCount = Math.min(5, dateLabelsArray.length);
                        const indices: number[] = [];
                        for (let i = 0; i < labelCount; i++) {
                            indices.push(Math.floor(i * (dateLabelsArray.length - 1) / Math.max(labelCount - 1, 1)));
                        }
                        // Remove duplicates
                        const uniqueIndices = [...new Set(indices)];

                        return uniqueIndices.map((idx, i) => {
                            const xPos = (idx / Math.max(dateLabelsArray.length - 1, 1)) * 100;
                            return (
                                <text
                                    key={i}
                                    x={Math.max(2, Math.min(98, xPos))}
                                    y="56"
                                    textAnchor={xPos < 10 ? 'start' : (xPos > 90 ? 'end' : 'middle')}
                                    fill="white"
                                    fillOpacity="0.5"
                                    fontSize="2.5"
                                >
                                    {dateLabelsArray[idx]}
                                </text>
                            );
                        });
                    }
                    return null;
                })()}

                {/* Main Path */}
                <path
                    ref={pathRef}
                    d={normalizedPath}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="drop-shadow(0 4px 6px rgba(0,0,0,0.3))"
                />
                <path
                    d={`${normalizedPath} L 100,50 L 0,50 Z`}
                    fill={`url(#gradient-${label})`}
                    opacity="0.5"
                />

                {/* Published Video Markers - YouTube Studio Style (Gray Squares) */}
                {computedMarkers.length > 0 && computedMarkers.map((marker, idx) => {
                    // Use percentage directly (0-100 scale matches viewBox width)
                    // The markers are positioned at the bottom of the chart
                    const xPct = marker.xPercent ?? marker.x ?? 50;
                    // Map 0-100 percentage to viewBox X coordinates
                    const markerX = (xPct / 100) * 100; // Simplified: just use percentage as X coordinate

                    return (
                        <g key={idx} transform={`translate(${markerX}, 52)`}
                            onMouseEnter={() => setMarkerHover({ ...marker, x: markerX })}
                            className="cursor-pointer"
                        >
                            {/* Gray square background - matches YouTube Studio */}
                            <rect x="-3" y="-3" width="6" height="6" fill="#606060" rx="1" />
                            {/* Video count number (supports 9+ format) */}
                            <text y="0" textAnchor="middle" fontSize="3.5" fill="white" fontWeight="500" dy=".35em">
                                {marker.countText || marker.count || '1'}
                            </text>
                        </g>
                    );
                })}

                {/* Hover Indicator */}
                {hover && (
                    <g>
                        <line x1={hover.x} y1="0" x2={hover.x} y2="50" stroke="white" strokeOpacity="0.2" strokeDasharray="2 2" />
                        <circle cx={hover.x} cy={hover.y} r="2" fill={color} stroke="white" strokeWidth="1" />
                    </g>
                )}
            </svg>

            {/* Hover Tooltip - YouTube Studio Style */}
            {hover && !markerHover && (
                <div
                    className="absolute bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg px-3 py-2 shadow-xl pointer-events-none z-20"
                    style={{
                        left: hover.x > 60 ? 'auto' : `${hover.x}%`,
                        right: hover.x > 60 ? `${100 - hover.x}%` : 'auto',
                        top: '5%',
                        transform: hover.x > 60 ? 'translateX(10px)' : 'translateX(-10px)'
                    }}
                >
                    <div className="text-gray-500 text-[11px] mb-0.5">{hover.date}</div>
                    <div className="font-bold text-gray-900 text-lg">{hover.value}</div>
                </div>
            )}

            {/* Marker Tooltip - YouTube Studio Style (White bg, clean list) */}
            {markerHover && (
                <div
                    className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-xl text-sm w-80"
                    style={{
                        left: markerHover.x > 50 ? 'auto' : `${Math.max(markerHover.x, 5)}%`,
                        right: markerHover.x > 50 ? `${Math.max(100 - markerHover.x, 5)}%` : 'auto',
                        bottom: '70px',
                        transform: markerHover.x > 50 ? 'translateX(20px)' : 'translateX(-20px)'
                    }}
                >
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-100">
                        <div className="font-medium text-gray-900">
                            {markerHover.label || `${markerHover.countText || markerHover.count || '1'} video${(markerHover.count || 1) > 1 ? 's' : ''} published`}
                        </div>
                    </div>

                    {/* Video List */}
                    <div className="max-h-64 overflow-y-auto">
                        {markerHover.videos && markerHover.videos.length > 0 ? (
                            markerHover.videos.map((v: any, i: number) => {
                                const thumbnail = v.thumbnailUrl || v.thumbnail;
                                const title = v.title || 'Untitled';
                                const videoId = v.videoId || v.id;
                                const watchUrl = v.watchUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '#');
                                const analyticsUrl = v.analyticsUrl || (videoId ? `https://studio.youtube.com/video/${videoId}/analytics` : '#');
                                const publishDate = v.publishDate || v.date || '';

                                return (
                                    <div
                                        key={i}
                                        className="flex gap-3 items-center px-4 py-2 hover:bg-gray-50 transition-colors group"
                                    >
                                        {/* Thumbnail */}
                                        <div className="w-16 h-9 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                                            {thumbnail ? (
                                                <img src={thumbnail} className="w-full h-full object-cover" alt={title} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400">🎬</div>
                                            )}
                                        </div>

                                        {/* Title & Date */}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-gray-900 font-medium text-sm truncate" title={title}>
                                                {title}
                                            </div>
                                            <div className="text-gray-500 text-xs">{publishDate}</div>
                                        </div>

                                        {/* Action Links */}
                                        <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <a
                                                href={watchUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-7 h-7 rounded bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                                                title="Watch Video"
                                            >
                                                <span className="text-xs">▶</span>
                                            </a>
                                            <a
                                                href={analyticsUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-7 h-7 rounded bg-gray-700 flex items-center justify-center text-white hover:bg-gray-800 transition-colors"
                                                title="Video Analytics"
                                            >
                                                <span className="text-xs">📊</span>
                                            </a>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            // Fallback for scraped markers (single video or count)
                            <div className="px-4 py-3">
                                <div className="flex gap-3 items-center">
                                    <div className="w-16 h-9 bg-gray-200 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                                        <span className="text-2xl">🎬</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-gray-900 font-medium text-sm">
                                            {markerHover.details?.title || "Video Details Unavailable"}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {markerHover.label || "Published on YouTube"}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-2 text-xs text-gray-400 text-center">
                                    Hover in YouTube Studio for full details
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
