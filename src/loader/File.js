var Class = require('../utils/Class');
var GetFastValue = require('../utils/object/GetFastValue');
var CONST = require('./const');
var GetURL = require('./GetURL');
var MergeXHRSettings = require('./MergeXHRSettings');
var XHRLoader = require('./XHRLoader');
var XHRSettings = require('./XHRSettings');

//  Phaser.Loader.File

var File = new Class({

    initialize:

    // old signature: type, key, url, responseType, xhrSettings, config
    function File (fileConfig)
    {
        //  file type (image, json, etc) for sorting within the Loader
        this.type = GetFastValue(fileConfig, 'type', false);

        //  unique cache key (unique within its file type)
        this.key = GetFastValue(fileConfig, 'key', false);

        if (!this.type || !this.key)
        {
            throw new Error('Error calling \'Loader.' + this.type + '\' invalid key provided.');
        }

        //  The URL of the file, not including baseURL
        this.url = GetFastValue(fileConfig, 'url');

        if (this.url === undefined)
        {
            this.url = GetFastValue(fileConfig, 'path', '') + this.key + '.' + GetFastValue(fileConfig, 'extension', '');
        }
        else
        {
            this.url = GetFastValue(fileConfig, 'path', '').concat(this.url);
        }

        //  Set when the Loader calls 'load' on this file
        this.src = '';

        this.xhrSettings = XHRSettings(GetFastValue(fileConfig, 'responseType', undefined));

        if (GetFastValue(fileConfig, 'xhrSettings', false))
        {
            this.xhrSettings = MergeXHRSettings(this.xhrSettings, GetFastValue(fileConfig, 'xhrSettings', {}));
        }

        //  The LoaderPlugin instance that is loading this file
        this.loader = null;

        this.xhrLoader = null;

        this.state = CONST.FILE_PENDING;

        //  Set by onProgress (only if loading via XHR)
        this.bytesTotal = 0;
        this.bytesLoaded = -1;
        this.percentComplete = -1;

        //  For CORs based loading.
        //  If this is undefined then the File will check BaseLoader.crossOrigin and use that (if set)
        this.crossOrigin = undefined;

        //  The actual processed file data
        this.data = undefined;

        //  A config object that can be used by file types to store transitional data
        this.config = GetFastValue(fileConfig, 'config', {});

        //  Multipart file? (i.e. an atlas and its json together)
        this.linkFile = undefined;
        this.linkType = '';
    },

    resetXHR: function ()
    {
        this.xhrLoader.onload = undefined;
        this.xhrLoader.onerror = undefined;
        this.xhrLoader.onprogress = undefined;
    },

    //  Called by the Loader, starts the actual file downloading.
    //  During the load the methods onLoad, onProgress, etc are called based on the XHR events.
    load: function (loader)
    {
        this.loader = loader;

        if (this.state === CONST.FILE_POPULATED)
        {
            this.onComplete();

            loader.nextFile(this);
        }
        else
        {
            this.src = GetURL(this, loader.baseURL);

            if (this.src.indexOf('data:') === 0)
            {
                console.log('Local data URI');
            }
            else
            {
                this.xhrLoader = XHRLoader(this, loader.xhr);
            }
        }
    },

    //  Called when the file loads, is sent a DOM ProgressEvent
    onLoad: function (event)
    {
        this.resetXHR();

        if (event.target && event.target.status !== 200)
        {
            this.loader.nextFile(this, false);
        }
        else
        {
            this.loader.nextFile(this, true);
        }
    },

    //  Called when the file errors, is sent a DOM ProgressEvent
    onError: function (event)
    {
        this.resetXHR();

        this.loader.nextFile(this, false);
    },

    onProgress: function (event)
    {
        if (event.lengthComputable)
        {
            this.bytesLoaded = event.loaded;
            this.bytesTotal = event.total;

            this.percentComplete = Math.min((this.bytesLoaded / this.bytesTotal), 1);

            // console.log(this.percentComplete + '% (' + this.bytesLoaded + ' bytes)');
            this.loader.emit('fileprogress', this, this.percentComplete);
        }
    },

    //  Usually overriden by the FileTypes and is called by Loader.finishedLoading.
    //  The callback is Loader.processUpdate
    onProcess: function (callback)
    {
        this.state = CONST.FILE_PROCESSING;

        this.onComplete();

        callback(this);
    },

    onComplete: function ()
    {
        if (this.linkFile)
        {
            if (this.linkFile.state === CONST.FILE_WAITING_LINKFILE)
            {
                //  The linkfile has finished processing, and is waiting for this file, so let's do them both
                this.state = CONST.FILE_COMPLETE;
                this.linkFile.state = CONST.FILE_COMPLETE;
            }
            else
            {
                //  The linkfile still hasn't finished loading and/or processing yet
                this.state = CONST.FILE_WAITING_LINKFILE;
            }
        }
        else
        {
            this.state = CONST.FILE_COMPLETE;
        }
    }

});

/**
 * Static method for creating object URL using URL API and setting it as image 'src' attribute.
 * If URL API is not supported (usually on old browsers) it falls back to creating Base64 encoded url using FileReader.
 *
 * @method createObjectURL
 * @static
 * @param image {Image} Image object which 'src' attribute should be set to object URL.
 * @param blob {Blob} A Blob object to create an object URL for.
 * @param defaultType {string} Default mime type used if blob type is not available.
 */
File.createObjectURL = function (image, blob, defaultType)
{
    if (typeof URL === 'function')
    {
        image.src = URL.createObjectURL(blob);
    }
    else
    {
        var reader = new FileReader();

        reader.onload = function ()
        {
            image.removeAttribute('crossOrigin');
            image.src = 'data:' + (blob.type || defaultType) + ';base64,' + reader.result.split(',')[1];
        };

        reader.onerror = image.onerror;

        reader.readAsDataURL(blob);
    }
};

/**
 * Static method for releasing an existing object URL which was previously created
 * by calling {@link File#createObjectURL} method.
 *
 * @method revokeObjectURL
 * @static
 * @param image {Image} Image object which 'src' attribute should be revoked.
 */
File.revokeObjectURL = function (image)
{
    if (typeof URL === 'function')
    {
        URL.revokeObjectURL(image.src);
    }
};

module.exports = File;
