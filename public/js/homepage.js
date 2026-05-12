// Homepage advertisement management
async function loadHomepageAd() {
    try {
        console.log('Homepage: Fetching ad from homepage_settings/advertisement...');
        const adDoc = await db.collection('homepage_settings').doc('advertisement').get();
        if (adDoc.exists) {
            const ad = adDoc.data();
            console.log('Homepage: Ad found:', ad);
            displayHomepageAd(ad);
        } else {
            console.log('Homepage: No ad in homepage_settings/advertisement');
            displayHomepageAd(null);
        }
    } catch (error) {
        console.error('Ana sayfa reklamı yüklenirken hata:', error);
    }
}

// Display advertisement on homepage
function displayHomepageAd(ad) {
    const contentSlot = document.getElementById('homepageAdContent');
    if (!contentSlot) {
        console.error('Homepage: homepageAdContent element not found!');
        return;
    }
    
    if (!ad || !ad.imageUrl) {
        console.log('Homepage: No ad or no imageUrl, showing placeholder');
        contentSlot.innerHTML = 'Reklamınız Burada Görünecek';
        return;
    }
    
    console.log('Homepage: Displaying ad with image:', ad.imageUrl);
    
    // Show only image or video on homepage; wrap in link if provided
    const wrapper = document.createElement('div');
    wrapper.style.textAlign = 'center';
    let mediaElem = null;
    
    if (ad.imageUrl) {
        const img = document.createElement('img');
        img.src = ad.imageUrl;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '400px';
        img.style.objectFit = 'cover';
        mediaElem = img;
    } else if (ad.videoUrl) {
        const vid = document.createElement('video');
        vid.src = ad.videoUrl;
        vid.controls = true;
        vid.style.maxWidth = '100%';
        vid.style.maxHeight = '400px';
        vid.style.objectFit = 'cover';
        mediaElem = vid;
    }
    
    if (mediaElem) {
        if (ad.link) {
            const a = document.createElement('a');
            a.href = ad.link;
            a.target = '_blank';
            a.rel = 'noopener';
            a.style.display = 'inline-block';
            a.appendChild(mediaElem);
            wrapper.appendChild(a);
        } else {
            wrapper.appendChild(mediaElem);
        }
    }
    
    contentSlot.innerHTML = '';
    contentSlot.appendChild(wrapper);
}
// Initialize homepage when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Try to load ad with a small delay to ensure Firebase is ready
    let retries = 0;
    const maxRetries = 10;
    
    const attemptLoad = () => {
        if (typeof db !== 'undefined' && db !== null) {
            console.log('Homepage: Firebase ready, loading ad...');
            loadHomepageAd();
        } else {
            retries++;
            if (retries < maxRetries) {
                console.log('Homepage: Firebase not ready yet, retrying... (' + retries + '/' + maxRetries + ')');
                setTimeout(attemptLoad, 100);
            } else {
                console.warn('Homepage: Firebase not available after retries');
            }
        }
    };
    
    attemptLoad();
});
