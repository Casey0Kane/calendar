/**
 * Created by jeremyblack on 5/17/16.
 */



function getData(){
    /**
     * This data is hard coded for testing purposes. In reality this would probably be making some ajax request
     * to get the data and return that.
     * @type {Array}
     */
    var events = [];
    events.push(createEvent("09:00:00", "10:45:00", EVENT_TYPE_ENUM.SPEAKER));
    events.push(createEvent("10:00:00", "11:00:00", EVENT_TYPE_ENUM.PERFORMANCE));
    events.push(createEvent("10:35:30", "16:00:00", EVENT_TYPE_ENUM.WORKSHOP));
    events.push(createEvent("11:20:00", "12:30:00", EVENT_TYPE_ENUM.DEMO));
    events.push(createEvent("12:15:00", "15:16:00", EVENT_TYPE_ENUM.PARTY));
    events.push(createEvent("16:00:01", "21:00:00", EVENT_TYPE_ENUM.PANEL));
    return {events: events}
}

EVENT_TYPE_ENUM = {
    PERFORMANCE: 'performance',
    PANEL: 'panel',
    SPEAKER: 'speaker',
    PARTY: 'party',
    WORKSHOP: 'workshop',
    DEMO: 'demo'
};


function createEvent(startTime, endTime, eventType, title, description, address){
    /**
     * Create an event with lots of default data. Can be used for testing to quickly create lots of events, or
     * when the user interacts with the UI to schedule something. StartTime and endTIme are mandatory, the rest
     * have reasonable defaults
     */
    if (startTime === undefined || endTime === undefined){
        throw "Must define start time and end time to create an event";
    }
    if ( eventType === undefined){
        eventType = EVENT_TYPE_ENUM.PANEL;
    }
    if ( title === undefined){
        title = 'A ' + eventType;
    }
    if ( description === undefined){
        description = 'An interesting ' + eventType;
    }
    if ( address === undefined){
        address = 'Meeting room B';
    }
    return {
        startTime: startTime,
        endTime: endTime,
        type: eventType,
        title: title,
        description: description,
        address: address

    }
}

function createTimeStamps(rangeStart, rangeEnd){
    /**
     * Based on the time range we want for this calendar, create a list of time htmls that go with it.
     * Since this content is uninteractive once placed, we don't need to worry about saving models or using
     * views for it particularly.
     * @type {string}
     */
    var timestamps = '';
    for (var hour = rangeStart; hour < rangeEnd; hour++){
        timestamps = timestamps + createTimeStamp(hour, true);
    }
    timestamps = timestamps + createTimeStamp(rangeEnd, false);
    $('#time_bar').html(timestamps)
}

function createTimeStamp(hour, showHalfHour){
    /**
     * Creates a timestamp and half hour timestamp html string.
     * @type {string}
     */
    var meridiem = 'AM';
    if (hour > 11){
        meridiem = 'PM';
    }
    if (hour > 12){
        hour -= 12;
    }
    var timestamp = '<div class="timestamp hour">' + hour + ':00 <span>' + meridiem + '</span></div>';
    if (showHalfHour){
        timestamp += '<div class="timestamp halfhour">' + hour + ':30</div>';
    }
    return timestamp;
}

function setCalendarHeight(hours){
    /**
     * Based on the number of hours involved, intelligently size the calendar.
     * @type {number}
     */
    var calendarHeight = 40 * ((hours) * 2);
    $('#calendar').css('height', calendarHeight);
    return calendarHeight;

}
$(document).on('ready', function() {
    var start = 9,
        end = 21;
    createTimeStamps(start, end);
    var height = setCalendarHeight(end - start);
    processEventColumns(start, end, height);
});

function sortEvents(events){
    /**
     * Sorts the list of events in place based on their start time
     */
    events.sort(function(a, b){
        return a.startTime - b.startTime;
    })
}

function parseTimeOffsets(events, start, end, height){
    for (var i = 0; i < events.length; i++){
        var event = events[i];
        event.startTime = parseTimeOffset(event.startTime, start, end, height);
        event.endTime = parseTimeOffset(event.endTime, start, end, height);
    }

}

function parseTimeOffset(timeString, calendarStartTime, calendarEndTime, calendarSize){
    /**
     * What we need to know about the time is it's percentage of the calendar length. We'll convert it
     * into an hour float, take that as a ratio of the total calendar time, and then multiply against the size,
     * which is in pixels, to know what the 'offset' for this time is in the backdrop.
     */
    var hours = timeStringToHours(timeString);
    if (hours < calendarStartTime){
        // This time range is outside the calendar! Instead of throwing, let's just nudge it into place for now.
        hours = calendarStartTime;
    } else if (hours > calendarEndTime){
        // outside in the other direction, once again nudge into place
        hours = calendarEndTime;
    }
    // Calibrate to the start time as the zero point
    hours -= calendarStartTime;

    var hourRatio = hours / (calendarEndTime - calendarStartTime);
    return calendarSize * hourRatio;
}

function timeStringToHours(timeString){
    var hours, minutes, seconds;
    if (timeString.length <= 7){
        // This timestring is not formatted as expected. We could fail here, but for the sake of getting something
        // displayed, we'll just zero it out for now. We ARE reading from our own data source, so this should
        // Be a bug, not an edge case.
        console.log("Invalid Timestring " + timeString + " zeroing it out instead of failing");
        timeString = "00:00:00";
    }
    hours = parseInt(timeString.substr(0, 2));
    minutes = parseInt(timeString.substr(3, 2));
    seconds = parseInt(timeString.substr(6, 2));
    return hours + minutes / 60.0 + seconds / 3600.0;
}

function assignEventColumns(events){
    /**
     * Adds to the events a column number indicating what column that event should display in.
     * returns the highest column required to display all columns with no overlap, so we know how wide to
     * make the columns.
     *
     */
    sortEvents(events);
    var current_events = [];
    for (var i = 0; i < events.length; i++){
        var event = events[i];
        var replaced = false; // Have we inserted it into our list yet?
        for (var j = 0; j < current_events.length; j++){
            var current_event = current_events[j];
            if (current_event === undefined || current_event.endTime <= event.startTime){
                if (!replaced){
                    // This one has timed out, replace it.
                    current_events[j] = event;
                    event.column = j;
                    replaced = true;
                } else {
                    // This one timed out, but we've already insert the latest event so just null it out.
                    current_events[j] = undefined;
                }
            }
        }
        if (!replaced){
            //We never put the current event in to take the place of another event, append it to the end.
            event.column = current_events.length;
            current_events.push(event);
        }
    }
    // Since we've been slowly making more buckets for the events, but never trimming them, the length of the
    // list is also the number of columns we'll need.
    return current_events.length;
}

function processEventColumns(start, end, size){
    /**
     * Get the event data from whatever our source is (In this case it is statically defined, but it could be
     * an ajax), turn it into html, and then display it.
     *
     * Note that this is not strongly extendible, a better solution would actually use a client side MVC working
     * off event models (parsed from the source), this controlling code, and views that would display the event.
     * This was, however, somewhat out of scope for this exercise.
     * @type {{events}|*}
     */
    var events = getData().events;
    parseTimeOffsets(events, start, end, size);
    var columns = assignEventColumns(events);
    var eventHtml = '';
    for (var i = 0; i < events.length; i++){
        eventHtml += buildEventHtml(events[i], columns);
    }
    $('#calendar').html(eventHtml);
}

function buildEventHtml(event, columns){
    /**
     * Turns an event model (really just a javascript object) into an html representation.
     * @type {number}
     */
    var width = 800.0 / columns;
    var height = Math.floor(event.endTime - event.startTime - 1);
    var margin = (width + 2) * event.column;
    var top = event.startTime;
    var eventType = event.type;
    var html = '<div class="event" style="height: ' + height + 'px; width: ' + width + 'px; margin-left: ' + margin + 'px; margin-top: ' + top + 'px;">';
    html += '<div class="bluetag ' + eventType + '"></div>';
    html += '<div class="title">' + event.title + '<span class="address">' + event.address + '</span></div>';
    html += '<div class="description">' + event.description + '</div>';
    html += '</div>';
    return html;
}