// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract UnshieldGroth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 7143244691896148442229410933133728973559956127159758747125603604867790776860;
    uint256 constant alphay  = 8417694375309591126621098042418373129299143629337231962131853280734001532350;
    uint256 constant betax1  = 20051057658890430645298014211094317456072789576176215423753949856660668381238;
    uint256 constant betax2  = 7590698765985390118070914852736623587055729841722924675548424647846259709461;
    uint256 constant betay1  = 12823571529436820973278148202425595496676223026986465925603468513310786454997;
    uint256 constant betay2  = 5748865814348440662544460816487531167806696840367964450236437029458903873743;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 10783548623212808941790477054170709309543132169242299089018785498559916515748;
    uint256 constant deltax2 = 6343005354656097705958402018924841787204503987268861560067130029146169620974;
    uint256 constant deltay1 = 12786426346928104321889362839931108140338237233583498423952303278687547669774;
    uint256 constant deltay2 = 3985957365814744148935527131533038448319178550944367645019471869284092195860;

    
    uint256 constant IC0x = 7225316972957841452774076457932657758708027370022733299235758781113435033672;
    uint256 constant IC0y = 14327540245869818459272280757598763720126917748432963748808763731842965911341;
    
    uint256 constant IC1x = 16484829523735192954560470757598765273752813115655173229447444872646602596120;
    uint256 constant IC1y = 3489027706238029372804573712016869781464555503077993107459906208644667097832;
    
    uint256 constant IC2x = 20779450068823173419759545600264280728917227248898475930726732827346110420064;
    uint256 constant IC2y = 4774741762705118747635806029441758310478829548419404688826332970821846971309;
    
    uint256 constant IC3x = 12211722856621240399692646781048983428815941399908240609663638581256400922426;
    uint256 constant IC3y = 13924325133672767222531559529150046384949628280073374033709305152503163369808;
    
    uint256 constant IC4x = 17845903440121418787515348714373681956206130580767289581990458511034734864328;
    uint256 constant IC4y = 19626357394024582698710917557448672765974709508415428222341796087413615253872;
    
    uint256 constant IC5x = 3056111647441098252772447314580516399069506525519863952403610763884659952767;
    uint256 constant IC5y = 8230088010379152217285903748832467645525109801781954339166542485433375601771;
    
    uint256 constant IC6x = 7931741641826026102892548939097042287939629803903579287448431051250233271129;
    uint256 constant IC6y = 1818573417317084725096792060150567383536481913179491973579787880613795666231;
    
    uint256 constant IC7x = 4171451842960964980249789071071250693572858122946912183262988146612603285022;
    uint256 constant IC7y = 164485877995389192391369830210214270543932992821260553377023812702487163843;
    
    uint256 constant IC8x = 21188316447417580254167365248247736184928898163863707756318357372969381095689;
    uint256 constant IC8y = 12467012618035926745323144807436721860613124747581814171170834191166634579380;
    
    uint256 constant IC9x = 5750676706788594683502517928831137447109936599480036953329208295820678654424;
    uint256 constant IC9y = 15744548511872743943604435037549708415528896269523804810359252658728416704088;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[9] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
