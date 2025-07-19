const User = require('../../models/userSchema');
const Referral = require('../../models/referralSchema');
const Wallet = require('../../models/walletSchema');

// Load referral page
const loadReferralPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        
        if (!userData) {
            return res.redirect('/login');
        }

        // Get referral statistics
        const referralStats = await Referral.aggregate([
            { $match: { referrerId: userId } },
            {
                $group: {
                    _id: null,
                    totalReferrals: { $sum: 1 },
                    totalEarnings: { $sum: '$rewardAmount' },
                    successfulReferrals: {
                        $sum: { $cond: [{ $eq: ['$rewardCredited', true] }, 1, 0] }
                    }
                }
            }
        ]);

        const stats = referralStats[0] || {
            totalReferrals: 0,
            totalEarnings: 0,
            successfulReferrals: 0
        };

        // Get recent referrals with user details
        const recentReferrals = await Referral.find({ referrerId: userId })
            .populate('refereeId', 'name email createdAt')
            .sort({ createdAt: -1 })
            .limit(10);

        // Get wallet balance
        const wallet = await Wallet.findOne({ userId: userId });
        const walletBalance = wallet ? wallet.balance : 0;

        res.render('referral', {
            user: userData,
            referralCode: userData.referralCode,
            stats,
            recentReferrals,
            walletBalance,
            baseUrl: req.protocol + '://' + req.get('host')
        });
    } catch (error) {
        console.error('Error loading referral page:', error);
        res.status(500).render('error', { 
            message: 'Failed to load referral page',
            user: null 
        });
    }
};

// Validate referral code
const validateReferralCode = async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code || code.trim().length === 0) {
            return res.json({ valid: false, message: 'Please enter a referral code' });
        }

        const referrer = await User.findOne({ 
            referralCode: code.trim().toUpperCase() 
        });

        if (!referrer) {
            return res.json({ valid: false, message: 'Invalid referral code' });
        }

        res.json({ 
            valid: true, 
            message: `Valid! You'll get benefits when you sign up with ${referrer.name}'s referral code`,
            referrerName: referrer.name
        });
    } catch (error) {
        console.error('Error validating referral code:', error);
        res.status(500).json({ valid: false, message: 'Error validating code' });
    }
};

// Get referral statistics for dashboard
const getReferralStats = async (req, res) => {
    try {
        const userId = req.session.user;
        
        const stats = await Referral.aggregate([
            { $match: { referrerId: userId } },
            {
                $group: {
                    _id: null,
                    totalReferrals: { $sum: 1 },
                    totalEarnings: { $sum: '$rewardAmount' },
                    thisMonth: {
                        $sum: {
                            $cond: [
                                {
                                    $gte: [
                                        '$createdAt',
                                        new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const result = stats[0] || {
            totalReferrals: 0,
            totalEarnings: 0,
            thisMonth: 0
        };

        res.json({ success: true, stats: result });
    } catch (error) {
        console.error('Error getting referral stats:', error);
        res.status(500).json({ success: false, message: 'Error fetching stats' });
    }
};

module.exports = {
    loadReferralPage,
    validateReferralCode,
    getReferralStats
};